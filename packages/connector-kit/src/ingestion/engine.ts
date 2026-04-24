import { Effect, Layer, Metric, Queue, Ref, Stream } from "effect";
import {
  HttpRouter,
  type HttpServer,
  HttpServerResponse,
} from "effect/unstable/http";

import type { ConnectorError } from "../core/errors";
import type {
  Batch,
  ConnectorDefinition,
  Cursor,
  EntityDefinition,
  EntityRow,
  EntitySchema,
  EventDefinition,
  IngestionState,
  LiveSource,
  Transform,
  WebhookStream,
} from "../core/types";

import { Publisher } from "../publisher/service";
import {
  ConnectorRuntimeContext,
  ConnectorRuntimeContextLayer,
} from "../runtime/context";
import { buildWebhookRouter } from "../webhook/server";
import type { WebhookRoute } from "../webhook/types";
import { StateStore } from "./state-store";

type TaggedBatch<T> = {
  readonly source: "live" | "backfill";
  readonly batch: Batch<T>;
};

const connectorBatchesTotal = Metric.counter("connector_batches_total", {
  description: "Total batches attempted by connector streams",
});

const connectorRowsTotal = Metric.counter("connector_rows_total", {
  description: "Total rows attempted by connector streams",
});

const connectorBatchSize = Metric.histogram("connector_batch_size", {
  description: "Distribution of batch row counts",
  boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

type RunConnectorBaseOptions = {
  readonly initialCutoff?: Cursor;
};

export type RunConnectorOptions<TWebhookPayload = never> =
  RunConnectorBaseOptions & {
    readonly webhook?: {
      readonly routes: ReadonlyArray<WebhookRoute<TWebhookPayload>>;
      readonly healthPath?: HttpRouter.PathInput;
      readonly disableHttpLogger?: boolean;
    };
  };

type RunConnectorNoWebhookOptions = RunConnectorBaseOptions & {
  readonly webhook?: undefined;
};

type RunConnectorWebhookOptions<TWebhookPayload> =
  RunConnectorOptions<TWebhookPayload> & {
    readonly webhook: NonNullable<
      RunConnectorOptions<TWebhookPayload>["webhook"]
    >;
  };

export function runConnector(
  connector: ConnectorDefinition,
  options?: RunConnectorNoWebhookOptions,
): Effect.Effect<void, ConnectorError, StateStore | Publisher>;
export function runConnector<TWebhookPayload>(
  connector: ConnectorDefinition,
  options: RunConnectorWebhookOptions<TWebhookPayload>,
): Effect.Effect<
  void,
  ConnectorError,
  StateStore | Publisher | HttpServer.HttpServer
>;
export function runConnector<TWebhookPayload>(
  connector: ConnectorDefinition,
  options?: RunConnectorOptions<TWebhookPayload>,
) {
  return Effect.withSpan(
    Effect.gen(function* () {
      const initialCutoff = options?.initialCutoff ?? new Date();
      const ingestion = runIngestion(connector, initialCutoff);

      if (!options?.webhook) {
        return yield* ingestion;
      }

      return yield* ingestion.pipe(
        Effect.provide(makeWebhookServerLayer(options.webhook)),
      );
    }).pipe(Effect.provide(ConnectorRuntimeContextLayer(connector))),
    "connector.run",
    {
      attributes: {
        "connector.name": connector.name,
        "connector.entities.count": connector.entities.length,
        "connector.events.count": connector.events.length,
      },
    },
  );
}

const runIngestion = (
  connector: ConnectorDefinition,
  initialCutoff: Cursor,
): Effect.Effect<
  void,
  ConnectorError,
  StateStore | Publisher | ConnectorRuntimeContext
> => {
  const entityRuns = connector.entities.map((entity) =>
    runEntity(entity, initialCutoff),
  );
  const eventRuns = connector.events.map((event) =>
    runEvent(event, initialCutoff),
  );

  return Effect.all([...entityRuns, ...eventRuns], {
    concurrency: "unbounded",
  }).pipe(Effect.asVoid);
};

const makeWebhookServerLayer = <TWebhookPayload>(options: {
  readonly routes: ReadonlyArray<WebhookRoute<TWebhookPayload>>;
  readonly healthPath?: HttpRouter.PathInput;
  readonly disableHttpLogger?: boolean;
}): Layer.Layer<never, never, HttpServer.HttpServer> => {
  const healthPath: HttpRouter.PathInput = options.healthPath ?? "/health";
  const app = Layer.mergeAll(
    buildWebhookRouter(options.routes),
    HttpRouter.add(
      "GET",
      healthPath,
      Effect.succeed(HttpServerResponse.text("ok")),
    ),
  );

  return HttpRouter.serve(app, {
    disableLogger: options.disableHttpLogger ?? true,
  });
};

const createInitialState = (cutoff: Cursor): IngestionState<Cursor> => ({
  backfill: { cutoff },
  live: { cutoff },
});

const makeStateRef = (
  key: string,
  initialCutoff: Cursor,
): Effect.Effect<Ref.Ref<IngestionState<Cursor>>, ConnectorError, StateStore> =>
  Effect.gen(function* () {
    // Load persisted state or initialize a new one for this stream.
    const store = yield* StateStore;
    const existing = yield* store.getState(key);
    const initial = existing ?? createInitialState(initialCutoff);
    return yield* Ref.make(initial);
  });

const runEntity = <S extends EntitySchema>(
  entity: EntityDefinition<S>,
  initialCutoff: Cursor,
): Effect.Effect<
  void,
  ConnectorError,
  StateStore | Publisher | ConnectorRuntimeContext
> =>
  Effect.gen(function* () {
    type Row = EntityRow<S>;
    const stateRef = yield* makeStateRef(entity.name, initialCutoff);
    // Tracks which primary keys have already been emitted.
    const seenRef = yield* Ref.make(new Set<string>());

    const liveStream = resolveLiveStream(entity.live);
    const tagLive = (batch: Batch<Row>) => ({
      source: "live" as const,
      batch,
    });
    const updateSeen = (rows: ReadonlyArray<Row>) =>
      Ref.update(seenRef, (seen) => {
        const next = new Set(seen);
        for (const row of rows) {
          const key = String(row[entity.primaryKey]);
          next.add(key);
        }
        return next;
      });

    // Entities are upserts, so live and backfill can overlap. We keep an in-memory
    // seen set (primary keys) so backfill does not re-emit rows already observed live.
    const backfillTagged = Stream.mapEffect(entity.backfill, (batch) =>
      Ref.get(seenRef).pipe(
        Effect.map((seen) => {
          const filtered = batch.rows.filter((row) => {
            const key = String(row[entity.primaryKey]);
            return !seen.has(key);
          });
          return {
            source: "backfill" as const,
            batch: { cursor: batch.cursor, rows: filtered },
          };
        }),
      ),
    ).pipe(Stream.tap(({ batch }) => updateSeen(batch.rows)));

    // For webhook live sources, we wait for the first live batch before starting
    // backfill. That first batch establishes the cutoff timestamp and seeds the
    // seen set so backfill can de-dupe correctly.
    // Queue-backed streams are single-consumer; splitting with take/drop would
    // consume and discard elements. Take the first element directly from the
    // queue, then let Stream.fromQueue continue from element #2.
    if (isWebhookStream(entity.live)) {
      const firstBatch = yield* Queue.take(entity.live.queue);
      yield* updateSeen(firstBatch.rows);
      yield* processTaggedStream(
        Stream.make({ source: "live" as const, batch: firstBatch }),
        entity.name,
        entity.transform,
        stateRef,
      );

      // liveStream is Stream.fromQueue on the same queue, continues from element #2.
      const liveTailTagged = Stream.map(liveStream, tagLive).pipe(
        Stream.tap(({ batch }) => updateSeen(batch.rows)),
      );
      const merged = Stream.merge(liveTailTagged, backfillTagged);
      yield* processTaggedStream(
        merged,
        entity.name,
        entity.transform,
        stateRef,
      );
      return;
    }

    // For pull-based live sources, we can merge immediately because there is no
    // webhook cutoff gating and the live stream is not queue-backed.
    const liveTagged = Stream.map(liveStream, tagLive).pipe(
      Stream.tap(({ batch }) => updateSeen(batch.rows)),
    );

    const merged = Stream.merge(liveTagged, backfillTagged);
    yield* processTaggedStream(merged, entity.name, entity.transform, stateRef);
  });

const runEvent = <S extends EntitySchema>(
  event: EventDefinition<S>,
  initialCutoff: Cursor,
): Effect.Effect<
  void,
  ConnectorError,
  StateStore | Publisher | ConnectorRuntimeContext
> =>
  Effect.gen(function* () {
    type Row = EntityRow<S>;
    const stateRef = yield* makeStateRef(event.name, initialCutoff);
    const liveStream = resolveLiveStream<Row>(event.live);

    // Events must backfill first to preserve ordering.
    if (event.backfill) {
      const backfillTagged = Stream.map(event.backfill, (batch) => ({
        source: "backfill" as const,
        batch,
      }));
      yield* processTaggedStream(
        backfillTagged,
        event.name,
        event.transform,
        stateRef,
      );
    }

    const liveTagged = Stream.map(liveStream, (batch) => ({
      source: "live" as const,
      batch,
    }));
    yield* processTaggedStream(
      liveTagged,
      event.name,
      event.transform,
      stateRef,
    );
  });

const updateState = (
  state: IngestionState<Cursor>,
  source: "live" | "backfill",
  cursor: Cursor,
): IngestionState<Cursor> =>
  source === "live"
    ? { ...state, live: { ...state.live, current: cursor } }
    : { ...state, backfill: { ...state.backfill, current: cursor } };

const resolveLiveStream = <T>(
  source: LiveSource<T>,
): Stream.Stream<Batch<T>, ConnectorError> =>
  isWebhookStream(source) ? source.stream : source;

const isWebhookStream = <T>(
  source: LiveSource<T>,
): source is WebhookStream<T> =>
  typeof source === "object" &&
  source !== null &&
  "queue" in source &&
  "stream" in source;

const processTaggedStream = <T extends Record<string, unknown>>(
  stream: Stream.Stream<TaggedBatch<T>, ConnectorError>,
  name: string,
  transform: Transform<T> | undefined,
  stateRef: Ref.Ref<IngestionState<Cursor>>,
): Effect.Effect<
  void,
  ConnectorError,
  StateStore | Publisher | ConnectorRuntimeContext
> =>
  Effect.gen(function* () {
    const runtime = yield* ConnectorRuntimeContext;
    const connectorName = runtime.connector.name;

    yield* Stream.runForEach(stream, ({ source, batch }) =>
      Effect.withSpan(
        Effect.gen(function* () {
          const metric = {
            connector: connectorName,
            stream: name,
            source,
          };

          yield* Metric.update(
            Metric.withAttributes(connectorBatchesTotal, metric),
            1,
          );
          yield* Metric.update(
            Metric.withAttributes(connectorRowsTotal, metric),
            batch.rows.length,
          );
          yield* Metric.update(
            Metric.withAttributes(connectorBatchSize, metric),
            batch.rows.length,
          );

          // Optional per-row transformation.
          const rows = transform
            ? yield* Effect.forEach(batch.rows, transform)
            : batch.rows;

          // Publish before updating cursor state.
          const publisher = yield* Publisher;
          yield* publisher.publish({
            name,
            source,
            batch: {
              cursor: batch.cursor,
              rows,
            },
          });

          // Persist state only after publish succeeds.
          const nextState = yield* Ref.updateAndGet(stateRef, (state) =>
            updateState(state, source, batch.cursor),
          );

          const store = yield* StateStore;
          yield* store.setState(name, nextState);
        }),
        "connector.batch.process",
        {
          attributes: {
            "connector.name": connectorName,
            "connector.stream.name": name,
            "connector.stream.source": source,
            "connector.batch.rows": batch.rows.length,
          },
        },
      ),
    );
  });
