import { DateTime, Effect, Layer, Metric, Queue } from "effect";
import { HttpRouter, type HttpServer, HttpServerResponse } from "effect/unstable/http";

import type {
  ConnectorDefinition,
  Cursor,
  ResourceBatch,
  ResourceDefinition,
  ResourceState,
  WebhookRoute,
} from "../core/types";

import { ConnectorError } from "../errors";
import { Publisher } from "../publisher/service";
import { StateStore } from "../state-store";
import {
  Attr,
  EventAttr,
  EventName,
  SpanName,
  addCurrentSpanEvent,
  annotateError,
} from "../telemetry";
import { router, WebhookQueue, type QueuedWebhookBatch } from "../webhook/server";

const connectorBatchesTotal = Metric.counter("connector_batches_total", {
  description: "Total resource batches attempted by connector sources",
});

const connectorMutationsTotal = Metric.counter("connector_mutations_total", {
  description: "Total resource mutations attempted by connector sources",
});

const connectorBatchSize = Metric.histogram("connector_batch_size", {
  description: "Distribution of resource mutation batch sizes",
  boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

type RunBaseOptions = {
  readonly initialCutoff?: Cursor.Value;
};

const normalizeCursor = (value: Cursor.Value): Cursor.Value =>
  value instanceof Date ? value.toISOString() : value;

const normalizeResourceState = (state: ResourceState): ResourceState => ({
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
): Effect.Effect<void, ConnectorError, StateStore | Publisher>;
export function run<const Resources extends ReadonlyArray<ResourceDefinition>>(
  connector: ConnectorDefinition<Resources>,
  options: RunWebhookOptions,
): Effect.Effect<void, ConnectorError, StateStore | Publisher | HttpServer.HttpServer>;
export function run(connector: ConnectorDefinition, options?: RunOptions) {
  const runtimeLayer = options?.webhook
    ? Layer.mergeAll(makeWebhookQueueLayer(), makeWebhookServerLayer(options.webhook))
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
    const webhookRun = options?.webhook ? runWebhookRuntime(options.webhook.routes) : Effect.void;

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

const runWebhookRuntime = (routes: ReadonlyArray<WebhookRoute>) => {
  const hasAfterEnqueue = routes.some((route) => route.ackMode === "after-enqueue");
  return Effect.all([hasAfterEnqueue ? runWebhookQueueConsumer : Effect.void, Effect.never], {
    concurrency: "unbounded",
  }).pipe(Effect.asVoid);
};

const runWebhookQueueConsumer = Effect.gen(function* () {
  const queue = yield* WebhookQueue;
  while (true) {
    const batch = yield* Queue.take(queue.queue);
    yield* publishBatch({ resource: batch.resource, source: "webhook", batch: batch.batch });
  }
});

const makeWebhookServerLayer = (options: {
  readonly routes: ReadonlyArray<WebhookRoute>;
  readonly healthPath?: HttpRouter.PathInput;
  readonly disableHttpLogger?: boolean;
}): Layer.Layer<never, never, HttpServer.HttpServer> => {
  const healthPath: HttpRouter.PathInput = options.healthPath ?? "/health";
  const app = Layer.mergeAll(
    router(options.routes),
    HttpRouter.add("GET", healthPath, Effect.succeed(HttpServerResponse.text("ok"))),
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

  return Effect.all(runs, { concurrency: "unbounded" }).pipe(Effect.asVoid);
};

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
      connector,
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
      connector,
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

const publishBatch = Effect.fnUntraced(function* (options: {
  readonly connector?: ConnectorDefinition;
  readonly resource: string;
  readonly source: "backfill" | "changes" | "webhook";
  readonly batch: ResourceBatch;
}) {
  const metric = {
    connector: options.connector?.name ?? "unknown",
    resource: options.resource,
    source: options.source,
  };
  yield* Metric.update(Metric.withAttributes(connectorBatchesTotal, metric), 1);
  yield* Metric.update(
    Metric.withAttributes(connectorMutationsTotal, metric),
    options.batch.mutations.length,
  );
  yield* Metric.update(
    Metric.withAttributes(connectorBatchSize, metric),
    options.batch.mutations.length,
  );

  const publisher = yield* Publisher;
  const ack = yield* publisher.publish({
    resource: options.resource,
    source: options.source,
    batch: options.batch,
  });

  yield* Effect.annotateCurrentSpan({ [Attr.publisherSuccess]: ack.status === "accepted" });
  if (ack.status === "rejected") {
    yield* Effect.annotateCurrentSpan({ [Attr.errorPhase]: "publish" });
    return yield* Effect.fail(
      new ConnectorError({
        message: `Publisher rejected batch for ${options.resource}: ${ack.reason}`,
      }),
    );
  }

  if (options.batch.cursor !== undefined) {
    yield* addCurrentSpanEvent(EventName.batchCheckpoint, {
      [EventAttr.batchCursor]: options.batch.cursor,
    });
  }
});
