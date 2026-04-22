import { Effect, Queue, Ref, Stream } from "effect";

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
import { StateStore } from "./state-store";

type TaggedBatch<T> = {
  readonly source: "live" | "backfill";
  readonly batch: Batch<T>;
};

export const runConnector = (
  connector: ConnectorDefinition,
  initialCutoff: Cursor,
): Effect.Effect<void, ConnectorError, StateStore | Publisher> =>
  Effect.gen(function* () {
    // Start ingestion for every entity and event in parallel.
    const entityRuns = connector.entities.map((entity) => runEntity(entity, initialCutoff));
    const eventRuns = connector.events.map((event) => runEvent(event, initialCutoff));
    // main runner
    yield* Effect.all([...entityRuns, ...eventRuns], {
      concurrency: "unbounded",
    });
  });

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
): Effect.Effect<void, ConnectorError, StateStore | Publisher> =>
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
      yield* processTaggedStream(merged, entity.name, entity.transform, stateRef);
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
): Effect.Effect<void, ConnectorError, StateStore | Publisher> =>
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
      yield* processTaggedStream(backfillTagged, event.name, event.transform, stateRef);
    }

    const liveTagged = Stream.map(liveStream, (batch) => ({
      source: "live" as const,
      batch,
    }));
    yield* processTaggedStream(liveTagged, event.name, event.transform, stateRef);
  });

const updateState = (
  state: IngestionState<Cursor>,
  source: "live" | "backfill",
  cursor: Cursor,
): IngestionState<Cursor> =>
  source === "live"
    ? { ...state, live: { ...state.live, current: cursor } }
    : { ...state, backfill: { ...state.backfill, current: cursor } };

const resolveLiveStream = <T>(source: LiveSource<T>): Stream.Stream<Batch<T>, ConnectorError> =>
  isWebhookStream(source) ? source.stream : source;

const isWebhookStream = <T>(source: LiveSource<T>): source is WebhookStream<T> =>
  typeof source === "object" && source !== null && "queue" in source && "stream" in source;

const processTaggedStream = <T extends Record<string, unknown>>(
  stream: Stream.Stream<TaggedBatch<T>, ConnectorError>,
  name: string,
  transform: Transform<T> | undefined,
  stateRef: Ref.Ref<IngestionState<Cursor>>,
): Effect.Effect<void, ConnectorError, StateStore | Publisher> =>
  Stream.runForEach(stream, ({ source, batch }) =>
    Effect.gen(function* () {
      // Optional per-row transformation.
      const rows = transform ? yield* Effect.forEach(batch.rows, transform) : batch.rows;

      // Publish before updating cursor state.
      const publisher = yield* Publisher;
      yield* publisher.publish({
        name,
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
  );
