import { DateTime, Effect, Layer, Queue } from "effect";
import { HttpRouter, type HttpServer, HttpServerResponse } from "effect/unstable/http";
import * as Observability from "effect/unstable/observability";

import type {
  ConnectorDefinition,
  Cursor,
  ResourceDefinition,
  ResourceState,
  WebhookRoute,
} from "../core/types";
import type { StateOperation, StateSource } from "../state-store/schema";

import { ConnectorError } from "../errors";
import * as Metrics from "../metrics";
import { publishBatch } from "../publisher/instrumented";
import { Publisher } from "../publisher/service";
import { StateStore } from "../state-store";
import { deriveSyncState, normalizeCursor } from "../state-store/state";
import { statusRoute } from "../status";
import { Attr, SpanName, annotateError } from "../telemetry";
import { router, WebhookQueue, type QueuedWebhookBatch } from "../webhook/server";

type RunBaseOptions = {
  readonly initialCutoff?: Cursor.Value;
};

export type RunOptions = RunBaseOptions & {
  readonly webhook?: {
    readonly routes: ReadonlyArray<WebhookRoute>;
    readonly healthPath?: HttpRouter.PathInput;
    readonly metricsPath?: HttpRouter.PathInput | false;
    readonly statusPath?: HttpRouter.PathInput | false;
    readonly disableHttpLogger?: boolean;
  };
};

type RunNoWebhookOptions = RunBaseOptions & {
  readonly webhook?: undefined;
};

type RunWebhookOptions = RunOptions & {
  readonly webhook: NonNullable<RunOptions["webhook"]>;
};

/**
 * Runs all connector ingestion loops. Callers provide the Publisher and
 * StateStore layers; webhook mode additionally requires an HttpServer layer.
 */
export function run<const Resources extends ReadonlyArray<ResourceDefinition>>(
  connector: ConnectorDefinition<Resources>,
  options?: RunNoWebhookOptions,
): Effect.Effect<void, ConnectorError, StateStore | Publisher>;
export function run<const Resources extends ReadonlyArray<ResourceDefinition>>(
  connector: ConnectorDefinition<Resources>,
  options: RunWebhookOptions,
): Effect.Effect<void, ConnectorError, StateStore | Publisher | HttpServer.HttpServer>;
export function run(connector: ConnectorDefinition, options?: RunOptions) {
  const queueLayer = makeWebhookQueueLayer(connector.name);
  const runtimeLayer = options?.webhook
    ? Layer.mergeAll(
        queueLayer,
        makeWebhookServerLayer(connector, options.webhook).pipe(Layer.provide(queueLayer)),
      )
    : Layer.empty;

  return Effect.gen(function* () {
    const initialCutoff =
      options?.initialCutoff ?? (yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)));
    yield* Effect.logInfo("Connector started").pipe(
      Effect.annotateLogs({
        [Attr.connectorName]: connector.name,
        resources: connector.resources.length,
      }),
    );

    const sourceRun = runIngestion(connector, initialCutoff);
    const webhookRun = options?.webhook
      ? runWebhookRuntime(connector, options.webhook.routes)
      : Effect.void;

    return yield* Effect.all([sourceRun, webhookRun], { concurrency: "unbounded" }).pipe(
      Effect.asVoid,
    );
  }).pipe(Effect.provide(runtimeLayer));
}

const makeWebhookQueueLayer = (connector: string): Layer.Layer<WebhookQueue> =>
  Layer.effect(WebhookQueue)(
    Effect.gen(function* () {
      const queue = yield* Queue.bounded<QueuedWebhookBatch>(1024);
      yield* Metrics.setWebhookQueueDepth(connector, 0);
      return WebhookQueue.of({ queue });
    }),
  );

const runWebhookRuntime = (connector: ConnectorDefinition, routes: ReadonlyArray<WebhookRoute>) => {
  const hasAfterEnqueue = routes.some((route) => route.ackMode === "after-enqueue");
  return Effect.all(
    [hasAfterEnqueue ? runWebhookQueueConsumer(connector) : Effect.void, Effect.never],
    {
      concurrency: "unbounded",
    },
  ).pipe(Effect.asVoid);
};

const runWebhookQueueConsumer = (connector: ConnectorDefinition) =>
  Effect.gen(function* () {
    const queue = yield* WebhookQueue;
    while (true) {
      const batch = yield* Queue.take(queue.queue);
      const depth = yield* Queue.size(queue.queue);
      yield* Metrics.setWebhookQueueDepth(connector.name, depth);
      yield* publishBatch({
        connector: connector.name,
        resource: batch.resource,
        source: "webhook",
        batch: batch.batch,
      });
    }
  });

const makeWebhookServerLayer = (
  connector: ConnectorDefinition,
  options: {
    readonly routes: ReadonlyArray<WebhookRoute>;
    readonly healthPath?: HttpRouter.PathInput;
    readonly metricsPath?: HttpRouter.PathInput | false;
    readonly statusPath?: HttpRouter.PathInput | false;
    readonly disableHttpLogger?: boolean;
  },
): Layer.Layer<never, never, HttpServer.HttpServer> => {
  const healthPath: HttpRouter.PathInput = options.healthPath ?? "/health";
  const metricsPath = options.metricsPath === undefined ? "/metrics" : options.metricsPath;
  const statusPath = options.statusPath === undefined ? "/status" : options.statusPath;
  const app = Layer.mergeAll(
    router(options.routes, { connectorName: connector.name }),
    HttpRouter.add("GET", healthPath, Effect.succeed(HttpServerResponse.text("ok"))),
    ...(metricsPath === false
      ? []
      : [Observability.PrometheusMetrics.layerHttp({ path: metricsPath })]),
    ...(statusPath === false ? [] : [statusRoute(connector, statusPath)]),
  );

  return HttpRouter.serve(app, {
    disableLogger: options.disableHttpLogger ?? true,
  });
};

const runIngestion = (
  connector: ConnectorDefinition,
  initialCutoff: Cursor.Value,
): Effect.Effect<void, ConnectorError, StateStore | Publisher> =>
  Effect.forEach(
    connector.resources,
    (resource) => runResourceSources(connector, resource, initialCutoff),
    {
      concurrency: "unbounded",
    },
  ).pipe(Effect.asVoid);

const initializeResourceState = (
  existing: ResourceState | undefined,
  initialCutoff: Cursor.Value,
): ResourceState => ({
  ...existing,
  changes: existing?.changes ?? { cursor: initialCutoff },
  backfill: existing?.backfill ?? {
    cutoff: initialCutoff,
    completed: false,
  },
});

const getInitializedState = Effect.fnUntraced(function* (
  resource: string,
  initialCutoff: Cursor.Value,
) {
  const store = yield* StateStore;
  const existing = yield* store.getResourceState(resource);
  return initializeResourceState(existing, initialCutoff);
});

const runResourceSources = (
  connector: ConnectorDefinition,
  resource: ResourceDefinition,
  initialCutoff: Cursor.Value,
) => {
  const runs = [
    resource.backfill
      ? isolateSourceFailure(
          runBackfill(connector, resource, initialCutoff),
          connector,
          resource,
          "backfill",
        )
      : Effect.void,
    resource.changes
      ? isolateSourceFailure(
          runChanges(connector, resource, initialCutoff),
          connector,
          resource,
          "changes",
        )
      : Effect.void,
  ];

  return initializeRuntimeStatus(connector, resource, initialCutoff).pipe(
    Effect.andThen(Effect.all(runs, { concurrency: "unbounded" })),
    Effect.asVoid,
    Effect.catch(() =>
      Metrics.setSyncState({ connector: connector.name, resource: resource.name }, "error").pipe(
        Effect.andThen(Effect.logError("Connector resource initialization failed")),
        Effect.annotateLogs({
          [Attr.connectorName]: connector.name,
          resource: resource.name,
        }),
        Effect.andThen(Effect.never),
      ),
    ),
  );
};

const recordResourceError =
  (
    connector: ConnectorDefinition,
    resource: ResourceDefinition,
    source: StateSource,
    operation: StateOperation,
  ) =>
  <A, R>(
    effect: Effect.Effect<A, ConnectorError, R>,
  ): Effect.Effect<A, ConnectorError, R | StateStore> =>
    effect.pipe(
      Effect.tapError(() =>
        Metrics.setSyncState({ connector: connector.name, resource: resource.name }, "error").pipe(
          Effect.andThen(
            StateStore.pipe(
              Effect.flatMap((store) => store.setResourceError(resource.name, source, operation)),
            ),
          ),
        ),
      ),
    );

const isolateSourceFailure = <A, R>(
  effect: Effect.Effect<A, ConnectorError, R>,
  connector: ConnectorDefinition,
  resource: ResourceDefinition,
  source: StateSource,
): Effect.Effect<A, never, R> =>
  // Only typed source errors are isolated. Defects and interruption still stop the runtime.
  effect.pipe(
    Effect.catch(() =>
      Effect.logError("Connector source parked").pipe(
        Effect.annotateLogs({
          [Attr.connectorName]: connector.name,
          resource: resource.name,
          source,
        }),
        Effect.andThen(Effect.never),
      ),
    ),
  );

const refreshRuntimeStatus = Effect.fnUntraced(function* (
  connector: ConnectorDefinition,
  resource: ResourceDefinition,
  initialCutoff: Cursor.Value,
) {
  const state = yield* getInitializedState(resource.name, initialCutoff);
  yield* Metrics.setSyncState(
    { connector: connector.name, resource: resource.name },
    deriveSyncState(resource, state),
  );
  return state;
});

const initializeRuntimeStatus = Effect.fnUntraced(function* (
  connector: ConnectorDefinition,
  resource: ResourceDefinition,
  initialCutoff: Cursor.Value,
) {
  const state = yield* getInitializedState(resource.name, initialCutoff);
  yield* Metrics.setSyncState(
    { connector: connector.name, resource: resource.name },
    deriveSyncState(resource, state),
  );
  if (resource.backfill) {
    yield* Metrics.setLastSuccessTimestamp(
      { connector: connector.name, resource: resource.name, source: "backfill" },
      state.backfill?.lastSuccessAt,
    );
  }
  if (resource.changes) {
    yield* Metrics.setLastSuccessTimestamp(
      { connector: connector.name, resource: resource.name, source: "changes" },
      state.changes?.lastSuccessAt,
    );
  }
});

const runBackfill = Effect.fnUntraced(function* (
  connector: ConnectorDefinition,
  resource: ResourceDefinition,
  initialCutoff: Cursor.Value,
) {
  if (!resource.backfill) return;
  const store = yield* StateStore;
  let state = yield* getInitializedState(resource.name, initialCutoff);

  if (state.backfill?.completed === true) {
    // The checkpoint may have committed before the previous process cleared
    // its error marker. It may also be hidden by a newer changes error.
    yield* store
      .clearResourceError(resource.name, "backfill")
      .pipe(recordResourceError(connector, resource, "backfill", "checkpoint"));
    yield* refreshRuntimeStatus(connector, resource, initialCutoff);
    return;
  }

  while (state.backfill?.completed !== true) {
    const backfill = state.backfill ?? { cutoff: initialCutoff, completed: false };
    const clearsVisibleError = state.lastError?.source === "backfill";
    const page = yield* resource.backfill
      .fetch({
        pageCursor: backfill.pageCursor,
        cutoff: backfill.cutoff,
      })
      .pipe(recordResourceError(connector, resource, "backfill", "fetch"));

    yield* publishBatch({
      connector: connector.name,
      resource: resource.name,
      source: "backfill",
      batch: {
        cursor: page.nextPageCursor ?? backfill.cutoff,
        mutations: page.mutations,
      },
    }).pipe(recordResourceError(connector, resource, "backfill", "publish"));

    const lastSuccessAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
    state = {
      ...state,
      backfill: {
        cutoff: backfill.cutoff,
        pageCursor: page.nextPageCursor,
        completed: !page.hasMore,
        lastSuccessAt,
      },
    };

    // Checkpoint only after publish succeeds so a crash cannot skip an
    // unacknowledged page; replay therefore remains at-least-once.
    yield* Effect.withSpan(
      store
        .setBackfillState(resource.name, {
          cutoff: normalizeCursor(backfill.cutoff),
          pageCursor:
            page.nextPageCursor === undefined ? undefined : normalizeCursor(page.nextPageCursor),
          completed: !page.hasMore,
          lastSuccessAt,
        })
        .pipe(
          Effect.andThen(
            Metrics.setLastSuccessTimestamp(
              { connector: connector.name, resource: resource.name, source: "backfill" },
              lastSuccessAt,
            ),
          ),
          Effect.andThen(store.clearResourceError(resource.name, "backfill")),
          Effect.tapError((error) => annotateError("state_set", error)),
        ),
      SpanName.stateSet,
      { attributes: { [Attr.stateKey]: resource.name } },
    ).pipe(recordResourceError(connector, resource, "backfill", "checkpoint"));

    // Completion or clearing an error can change the resource-wide sync state.
    if (clearsVisibleError || !page.hasMore) {
      state = yield* refreshRuntimeStatus(connector, resource, initialCutoff);
    }
  }
});

const runChanges = Effect.fnUntraced(function* (
  connector: ConnectorDefinition,
  resource: ResourceDefinition,
  initialCutoff: Cursor.Value,
) {
  if (!resource.changes) return;
  const store = yield* StateStore;

  while (true) {
    const state = yield* getInitializedState(resource.name, initialCutoff);
    const cursor = state.changes?.cursor ?? initialCutoff;
    const clearsVisibleError = state.lastError?.source === "changes";
    const page = yield* resource.changes
      .fetch({ cursor })
      .pipe(recordResourceError(connector, resource, "changes", "fetch"));

    yield* publishBatch({
      connector: connector.name,
      resource: resource.name,
      source: "changes",
      batch: {
        cursor: page.cursor,
        mutations: page.mutations,
      },
    }).pipe(recordResourceError(connector, resource, "changes", "publish"));

    const lastSuccessAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
    // Advance the durable cursor only after Wings accepts the page.
    yield* Effect.withSpan(
      store
        .setChangesState(resource.name, {
          cursor: normalizeCursor(page.cursor),
          lastSuccessAt,
        })
        .pipe(
          Effect.andThen(
            Metrics.setLastSuccessTimestamp(
              { connector: connector.name, resource: resource.name, source: "changes" },
              lastSuccessAt,
            ),
          ),
          Effect.andThen(store.clearResourceError(resource.name, "changes")),
          Effect.tapError((error) => annotateError("state_set", error)),
        ),
      SpanName.stateSet,
      { attributes: { [Attr.stateKey]: resource.name } },
    ).pipe(recordResourceError(connector, resource, "changes", "checkpoint"));

    if (clearsVisibleError) {
      yield* refreshRuntimeStatus(connector, resource, initialCutoff);
    }

    yield* Effect.sleep(resource.changes.interval ?? "1 minute");
  }
});
