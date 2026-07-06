import { DateTime, Effect, Layer, Queue } from "effect";
import { HttpRouter, type HttpServer, HttpServerResponse } from "effect/unstable/http";
import * as Observability from "effect/unstable/observability";
import { KeyValueStore } from "effect/unstable/persistence";

import type {
  ConnectorDefinition,
  Cursor,
  ResourceDefinition,
  ResourceState,
  WebhookRoute,
} from "../core/types";

import { ConnectorError } from "../errors";
import * as Metrics from "../metrics";
import { publishBatch } from "../publisher/instrumented";
import { Publisher } from "../publisher/service";
import {
  deriveSyncState,
  normalizeCursor,
  StateStore,
  layer as StateStoreLayer,
  type PersistedResourceState,
} from "../state-store";
import { statusRoute } from "../status";
import { Attr, SpanName, annotateError } from "../telemetry";
import { router, WebhookQueue, type QueuedWebhookBatch } from "../webhook/server";

type RunBaseOptions = {
  readonly initialCutoff?: Cursor.Value;
};

const normalizeResourceState = (state: ResourceState): PersistedResourceState => ({
  backfill: state.backfill
    ? {
        cutoff: normalizeCursor(state.backfill.cutoff),
        pageCursor:
          state.backfill.pageCursor === undefined
            ? undefined
            : normalizeCursor(state.backfill.pageCursor),
        completed: state.backfill.completed,
      }
    : undefined,
  changes: state.changes
    ? {
        cursor: normalizeCursor(state.changes.cursor),
      }
    : undefined,
});

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

export function run<const Resources extends ReadonlyArray<ResourceDefinition>>(
  connector: ConnectorDefinition<Resources>,
  options?: RunNoWebhookOptions,
): Effect.Effect<void, ConnectorError, KeyValueStore.KeyValueStore | Publisher>;
export function run<const Resources extends ReadonlyArray<ResourceDefinition>>(
  connector: ConnectorDefinition<Resources>,
  options: RunWebhookOptions,
): Effect.Effect<
  void,
  ConnectorError,
  KeyValueStore.KeyValueStore | Publisher | HttpServer.HttpServer
>;
export function run(connector: ConnectorDefinition, options?: RunOptions) {
  const stateStoreLayer = StateStoreLayer;
  const queueLayer = makeWebhookQueueLayer();
  const runtimeLayer = options?.webhook
    ? Layer.mergeAll(
        stateStoreLayer,
        queueLayer,
        makeWebhookServerLayer(connector, options.webhook).pipe(
          Layer.provide(Layer.mergeAll(stateStoreLayer, queueLayer)),
        ),
      )
    : stateStoreLayer;

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

const makeWebhookQueueLayer = (): Layer.Layer<WebhookQueue> =>
  Layer.effect(WebhookQueue)(
    Effect.gen(function* () {
      const queue = yield* Queue.bounded<QueuedWebhookBatch>(1024);
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
    resource.backfill ? runBackfill(connector, resource, initialCutoff) : Effect.void,
    resource.changes ? runChanges(connector, resource, initialCutoff) : Effect.void,
  ];

  return initializeRuntimeStatus(connector, resource, initialCutoff).pipe(
    Effect.andThen(Effect.all(runs, { concurrency: "unbounded" })),
    Effect.asVoid,
    Effect.catchCause((cause) =>
      StateStore.pipe(
        Effect.flatMap((store) => store.setResourceError(resource.name, cause)),
        Effect.andThen(
          Metrics.setSyncState({ connector: connector.name, resource: resource.name }, "error"),
        ),
        Effect.andThen(Effect.failCause(cause)),
      ),
    ),
  );
};

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
});

const runBackfill = Effect.fnUntraced(function* (
  connector: ConnectorDefinition,
  resource: ResourceDefinition,
  initialCutoff: Cursor.Value,
) {
  if (!resource.backfill) return;
  const store = yield* StateStore;
  let state = yield* getInitializedState(resource.name, initialCutoff);

  while (state.backfill?.completed !== true) {
    const backfill = state.backfill ?? { cutoff: initialCutoff, completed: false };
    const page = yield* resource.backfill.fetch({
      pageCursor: backfill.pageCursor,
      cutoff: backfill.cutoff,
    });

    yield* publishBatch({
      connector: connector.name,
      resource: resource.name,
      source: "backfill",
      batch: {
        cursor: page.nextPageCursor ?? backfill.cutoff,
        mutations: page.mutations,
      },
    });

    state = {
      ...state,
      backfill: {
        cutoff: backfill.cutoff,
        pageCursor: page.nextPageCursor,
        completed: !page.hasMore,
      },
    };

    yield* Effect.withSpan(
      store
        .setResourceState(resource.name, normalizeResourceState(state))
        .pipe(Effect.tapError((error) => annotateError("state_set", error))),
      SpanName.stateSet,
      { attributes: { [Attr.stateKey]: resource.name } },
    );
  }

  yield* Metrics.setSyncState({ connector: connector.name, resource: resource.name }, "live");
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
    const page = yield* resource.changes.fetch({ cursor });

    yield* publishBatch({
      connector: connector.name,
      resource: resource.name,
      source: "changes",
      batch: {
        cursor: page.cursor,
        mutations: page.mutations,
      },
    });

    yield* Effect.withSpan(
      store
        .setResourceState(
          resource.name,
          normalizeResourceState({
            ...state,
            changes: { cursor: page.cursor },
          }),
        )
        .pipe(Effect.tapError((error) => annotateError("state_set", error))),
      SpanName.stateSet,
      { attributes: { [Attr.stateKey]: resource.name } },
    );

    yield* Effect.sleep(resource.changes.interval ?? "1 minute");
  }
});
