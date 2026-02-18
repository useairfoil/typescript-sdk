import { Effect, Ref, Stream } from "effect";
import type { ConnectorError } from "../core/errors";
import type {
  Batch,
  ConnectorDefinition,
  Cursor,
  EntityDefinition,
  EventDefinition,
  IngestionState,
  LiveSource,
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
    const entityRuns = connector.entities.map((entity) =>
      runEntity(entity, initialCutoff),
    );
    const eventRuns = connector.events.map((event) =>
      runEvent(event, initialCutoff),
    );
    // main runner
    yield* Effect.all([...entityRuns, ...eventRuns]);
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

const runEntity = <T extends Record<string, unknown>>(
  entity: EntityDefinition<T>,
  initialCutoff: Cursor,
): Effect.Effect<void, ConnectorError, StateStore | Publisher> =>
  Effect.gen(function* () {
    const stateRef = yield* makeStateRef(entity.name, initialCutoff);
    // Tracks which primary keys have already been emitted.
    const seen = new Set<string>();

    const liveStream = resolveLiveStream(entity.live);
    const tagLive = (batch: Batch<T>) => ({
      source: "live" as const,
      batch,
    });
    const updateSeen = (rows: ReadonlyArray<T>) =>
      Effect.sync(() => {
        for (const row of rows) {
          const key = String(row[entity.primaryKey]);
          seen.add(key);
        }
      });

    // Backfill rows are filtered if we've already seen them via live.
    const backfillTagged = Stream.map(entity.backfill, (batch) => {
      const filtered = batch.rows.filter((row) => {
        const key = String(row[entity.primaryKey]);
        return !seen.has(key);
      });
      return {
        source: "backfill" as const,
        batch: { cursor: batch.cursor, rows: filtered },
      };
    }).pipe(Stream.tap(({ batch }) => updateSeen(batch.rows)));

    // For webhook live sources, wait for the first live batch before backfill.
    if (isWebhookStream(entity.live)) {
      const liveHead = Stream.take(liveStream, 1);
      const liveTail = Stream.drop(liveStream, 1);

      const liveHeadTagged = Stream.map(liveHead, tagLive).pipe(
        Stream.tap(({ batch }) => updateSeen(batch.rows)),
      );

      const liveTailTagged = Stream.map(liveTail, tagLive).pipe(
        Stream.tap(({ batch }) => updateSeen(batch.rows)),
      );

      yield* processTaggedStream(
        liveHeadTagged,
        entity.name,
        entity.transform,
        stateRef,
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

    // For pull-based live sources, merge immediately with backfill.
    const liveTagged = Stream.map(liveStream, tagLive).pipe(
      Stream.tap(({ batch }) => updateSeen(batch.rows)),
    );

    const merged = Stream.merge(liveTagged, backfillTagged);
    yield* processTaggedStream(merged, entity.name, entity.transform, stateRef);
  });

const runEvent = <T extends Record<string, unknown>>(
  event: EventDefinition<T>,
  initialCutoff: Cursor,
): Effect.Effect<void, ConnectorError, StateStore | Publisher> =>
  Effect.gen(function* () {
    const stateRef = yield* makeStateRef(event.name, initialCutoff);
    const liveStream = resolveLiveStream(event.live);

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
  typeof source === "object" && source !== null && "stream" in source;

const processTaggedStream = <T>(
  stream: Stream.Stream<TaggedBatch<T>, ConnectorError>,
  name: string,
  transform: ((row: T) => Effect.Effect<T, ConnectorError>) | undefined,
  stateRef: Ref.Ref<IngestionState<Cursor>>,
): Effect.Effect<void, ConnectorError, StateStore | Publisher> =>
  Stream.runForEach(stream, ({ source, batch }) =>
    Effect.gen(function* () {
      // Optional per-row transformation.
      const rows = transform
        ? yield* Effect.forEach(batch.rows, transform)
        : batch.rows;

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
