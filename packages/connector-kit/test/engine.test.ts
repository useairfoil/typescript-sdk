import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Queue, Ref, Schema, Stream } from "effect";

import type { ConnectorError } from "../src/core/errors";

import { defineConnector, defineEntity } from "../src/core/builder";
import { runConnector } from "../src/ingestion/engine";
import { StateStoreInMemory } from "../src/ingestion/state-store";
import { Publisher } from "../src/publisher/service";
import { makeWebhookQueue } from "../src/streams/webhook-queue";

type TestRow = { readonly id: string; readonly created_at: string };

const TestRowSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
});

const makeTestPublisher = (
  publishedRef: Ref.Ref<ReadonlyArray<TestRow>>,
  done: Deferred.Deferred<void, never>,
  expectedCount: number,
) =>
  Layer.succeed(Publisher)({
    publish: ({ source: _source, batch }) =>
      Effect.gen(function* () {
        const rows = batch.rows as ReadonlyArray<TestRow>;
        const next = yield* Ref.updateAndGet(publishedRef, (acc) => [...acc, ...rows]);
        if (next.length >= expectedCount) {
          yield* Deferred.succeed(done, undefined);
        }
        return { success: true };
      }),
  });

describe("engine merging logic", () => {
  it.effect("deduplicates backfill rows that were already seen in the live stream", () =>
    Effect.gen(function* () {
      const { queue, stream } = yield* makeWebhookQueue<TestRow>({
        capacity: 100,
      });

      const liveRow: TestRow = {
        id: "row-1",
        created_at: "2024-01-02T00:00:00Z",
      };
      const backfillOnlyRow: TestRow = {
        id: "row-2",
        created_at: "2024-01-01T00:00:00Z",
      };

      // Backfill contains both rows; row-1 was already seen via live so
      // it must not appear a second time in the published output.
      const backfill: Stream.Stream<
        { cursor: string; rows: ReadonlyArray<TestRow> },
        ConnectorError
      > = Stream.make({
        cursor: "2024-01-01T00:00:00Z",
        rows: [liveRow, backfillOnlyRow],
      });

      const entity = defineEntity({
        name: "test",
        schema: TestRowSchema,
        primaryKey: "id",
        live: { queue, stream },
        backfill,
      });

      const connector = defineConnector({
        name: "test",
        entities: [entity],
        events: [],
      });

      const publishedRef = yield* Ref.make<ReadonlyArray<TestRow>>([]);
      // Expect 2 rows total: row-1 from live and row-2 from backfill.
      const done = yield* Deferred.make<void, never>();
      const publisherLayer = makeTestPublisher(publishedRef, done, 2);

      yield* Effect.forkScoped(
        runConnector(connector, { initialCutoff: new Date() }).pipe(
          Effect.provide(StateStoreInMemory),
          Effect.provide(publisherLayer),
        ),
      );

      // Trigger the live stream with row-1.
      yield* Queue.offer(queue, {
        cursor: "2024-01-02T00:00:00Z",
        rows: [liveRow],
      });

      yield* Deferred.await(done);

      const published = yield* Ref.get(publishedRef);
      const ids = published.map((r) => r.id);

      // row-1 appears exactly once (from live, not duplicated by backfill).
      expect(ids.filter((id) => id === "row-1")).toHaveLength(1);
      // row-2 appears exactly once (from backfill only).
      expect(ids.filter((id) => id === "row-2")).toHaveLength(1);
    }).pipe(Effect.scoped),
  );

  it.effect("publishes all backfill rows when there is no overlap with live", () =>
    Effect.gen(function* () {
      const { queue, stream } = yield* makeWebhookQueue<TestRow>({
        capacity: 100,
      });

      const liveRow: TestRow = {
        id: "live-1",
        created_at: "2024-01-03T00:00:00Z",
      };
      const backfillRows: ReadonlyArray<TestRow> = [
        { id: "back-1", created_at: "2024-01-02T00:00:00Z" },
        { id: "back-2", created_at: "2024-01-01T00:00:00Z" },
      ];

      const backfill: Stream.Stream<
        { cursor: string; rows: ReadonlyArray<TestRow> },
        ConnectorError
      > = Stream.make({ cursor: "2024-01-01T00:00:00Z", rows: backfillRows });

      const entity = defineEntity({
        name: "test",
        schema: TestRowSchema,
        primaryKey: "id",
        live: { queue, stream },
        backfill,
      });

      const connector = defineConnector({
        name: "test",
        entities: [entity],
        events: [],
      });

      const publishedRef = yield* Ref.make<ReadonlyArray<TestRow>>([]);
      // Expect 3 rows total: 1 live + 2 backfill.
      const done = yield* Deferred.make<void, never>();
      const publisherLayer = makeTestPublisher(publishedRef, done, 3);

      yield* Effect.forkScoped(
        runConnector(connector, { initialCutoff: new Date() }).pipe(
          Effect.provide(StateStoreInMemory),
          Effect.provide(publisherLayer),
        ),
      );

      yield* Queue.offer(queue, {
        cursor: "2024-01-03T00:00:00Z",
        rows: [liveRow],
      });

      yield* Deferred.await(done);

      const published = yield* Ref.get(publishedRef);
      const ids = published.map((r) => r.id);

      expect(ids).toContain("live-1");
      expect(ids).toContain("back-1");
      expect(ids).toContain("back-2");
      expect(ids).toHaveLength(3);
    }).pipe(Effect.scoped),
  );

  it.effect("publishes nothing from backfill when all rows were already seen live", () =>
    Effect.gen(function* () {
      const { queue, stream } = yield* makeWebhookQueue<TestRow>({
        capacity: 100,
      });

      const row: TestRow = {
        id: "row-1",
        created_at: "2024-01-01T00:00:00Z",
      };

      // Backfill contains the same row as live.
      const backfill: Stream.Stream<
        { cursor: string; rows: ReadonlyArray<TestRow> },
        ConnectorError
      > = Stream.make({ cursor: "2024-01-01T00:00:00Z", rows: [row] });

      const entity = defineEntity({
        name: "test",
        schema: TestRowSchema,
        primaryKey: "id",
        live: { queue, stream },
        backfill,
      });

      const connector = defineConnector({
        name: "test",
        entities: [entity],
        events: [],
      });

      const publishedRef = yield* Ref.make<ReadonlyArray<TestRow>>([]);
      // Only 1 publish expected: the live row. Backfill emits an empty batch
      // after dedup, which the engine still publishes (with 0 rows).
      const done = yield* Deferred.make<void, never>();
      const publisherLayer = makeTestPublisher(publishedRef, done, 1);

      yield* Effect.forkScoped(
        runConnector(connector, { initialCutoff: new Date() }).pipe(
          Effect.provide(StateStoreInMemory),
          Effect.provide(publisherLayer),
        ),
      );

      yield* Queue.offer(queue, {
        cursor: "2024-01-01T00:00:00Z",
        rows: [row],
      });

      yield* Deferred.await(done);

      const published = yield* Ref.get(publishedRef);
      // row-1 must appear exactly once across all published batches.
      const count = published.filter((r) => r.id === "row-1").length;
      expect(count).toBe(1);
    }).pipe(Effect.scoped),
  );
});
