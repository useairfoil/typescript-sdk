import { WingsContainer } from "@airfoil/flight/test";
import { expect, it as vitest } from "@effect/vitest";
import { Chunk, Effect, Stream } from "effect";
import { customAlphabet } from "nanoid";
import { afterAll, beforeAll, describe } from "vitest";
import {
  arrowTableToRowColumns,
  PV,
  recordBatchToTable,
  WingsClient,
} from "../src";
import { makeTestBatch } from "./helpers";

const makeTopicId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 12);

describe("Fetcher (Effect)", () => {
  let wingsContainer: WingsContainer | null = null;

  beforeAll(async () => {
    wingsContainer = await new WingsContainer().start();
  }, 60_000);

  afterAll(async () => {
    if (wingsContainer !== null) {
      await wingsContainer.stop();
      wingsContainer = null;
    }
  });

  vitest.effect("should fetch data without partition key", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      yield* Effect.gen(function* () {
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterMetadata();

          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [{ name: "my_field", dataType: "Int32", nullable: false }],
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
            },
          });
        });

        const publisher = yield* WingsClient.publisher({ topic });

        yield* publisher.push({ batch: makeTestBatch() });
        yield* publisher.push({ batch: makeTestBatch() });

        const stream = yield* WingsClient.fetch({
          topic,
          offset: 0n,
        });

        const batches = yield* stream.pipe(Stream.take(2), Stream.runCollect);

        const table = recordBatchToTable([...Chunk.toReadonlyArray(batches)]);
        const { columns, rows } = arrowTableToRowColumns(table);

        expect(rows).toMatchObject([
          { __offset__: 0n, my_field: 1 },
          { __offset__: 1n, my_field: 2 },
          { __offset__: 2n, my_field: 3 },
          { __offset__: 3n, my_field: 4 },
          { __offset__: 4n, my_field: 1 },
          { __offset__: 5n, my_field: 2 },
          { __offset__: 6n, my_field: 3 },
          { __offset__: 7n, my_field: 4 },
        ]);

        expect(columns).toHaveLength(3);
        expect(columns[0]).toMatchObject({
          name: "my_field",
          type: "Int32",
        });
        expect(columns[1]).toMatchObject({
          name: "__offset__",
          type: "Uint64",
        });
      }).pipe(Effect.provide(wingsLayer));
    }),
  );

  vitest.effect("should fetch data with partition key", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      yield* Effect.gen(function* () {
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterMetadata();
          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [
              { name: "my_field", dataType: "Int32", nullable: false },
              { name: "my_part", dataType: "Int32", nullable: false },
            ],
            partitionKey: 1,
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
            },
          });
        });

        const publisher = yield* WingsClient.publisher({ topic });

        yield* publisher.push({
          batch: makeTestBatch(),
          partitionValue: PV.int32(1000),
        });
        yield* publisher.push({
          batch: makeTestBatch(),
          partitionValue: PV.int32(2000),
        });

        const streamP1 = yield* WingsClient.fetch({
          topic,
          partitionValue: PV.int32(1000),
          offset: 0n,
        });

        const batchesP1 = yield* streamP1.pipe(
          Stream.take(1),
          Stream.runCollect,
        );

        const tableP1 = recordBatchToTable([
          ...Chunk.toReadonlyArray(batchesP1),
        ]);
        const { rows: rowsP1 } = arrowTableToRowColumns(tableP1);

        expect(rowsP1).toMatchObject([
          { __offset__: 0n, my_field: 1, my_part: 1000 },
          { __offset__: 1n, my_field: 2, my_part: 1000 },
          { __offset__: 2n, my_field: 3, my_part: 1000 },
          { __offset__: 3n, my_field: 4, my_part: 1000 },
        ]);

        const streamP2 = yield* WingsClient.fetch({
          topic,
          partitionValue: PV.int32(2000),
          offset: 0n,
        });

        const batchesP2 = yield* streamP2.pipe(
          Stream.take(1),
          Stream.runCollect,
        );

        const tableP2 = recordBatchToTable([
          ...Chunk.toReadonlyArray(batchesP2),
        ]);
        const { rows: rowsP2 } = arrowTableToRowColumns(tableP2);

        expect(rowsP2).toMatchObject([
          { __offset__: 0n, my_field: 1, my_part: 2000 },
          { __offset__: 1n, my_field: 2, my_part: 2000 },
          { __offset__: 2n, my_field: 3, my_part: 2000 },
          { __offset__: 3n, my_field: 4, my_part: 2000 },
        ]);
      }).pipe(Effect.provide(wingsLayer));
    }),
  );

  vitest.effect("should handle stream operations", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      yield* Effect.gen(function* () {
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterMetadata();
          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [{ name: "my_field", dataType: "Int32", nullable: false }],
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
            },
          });
        });

        const publisher = yield* WingsClient.publisher({ topic });

        yield* publisher.push({ batch: makeTestBatch() });

        const stream = yield* WingsClient.fetch({
          topic,
          offset: 0n,
        });

        const batches = yield* stream.pipe(
          Stream.filter((batch) => batch.numRows > 0),
          Stream.take(1),
          Stream.runCollect,
        );

        expect(Chunk.size(batches)).toBeGreaterThan(0);
        const firstBatch = Chunk.unsafeGet(batches, 0);
        expect(firstBatch.numRows).toBeGreaterThan(0);
      }).pipe(Effect.provide(wingsLayer));
    }),
  );

  vitest.effect("should fetch from specific offset", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      yield* Effect.gen(function* () {
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterMetadata();
          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [{ name: "my_field", dataType: "Int32", nullable: false }],
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
            },
          });
        });

        const publisher = yield* WingsClient.publisher({ topic });

        yield* publisher.push({ batch: makeTestBatch() }); // Offsets 0-3

        // Fetch from offset 2
        const stream = yield* WingsClient.fetch({
          topic,
          offset: 2n,
        });

        const batches = yield* stream.pipe(Stream.take(1), Stream.runCollect);

        const table = recordBatchToTable([...Chunk.toReadonlyArray(batches)]);
        const { rows } = arrowTableToRowColumns(table);

        // Should start from offset 2
        expect(rows[0].__offset__).toBeGreaterThanOrEqual(2n);
      }).pipe(Effect.provide(wingsLayer));
    }),
  );

  vitest.effect("should push and fetch in the same program", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      yield* Effect.gen(function* () {
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterMetadata();
          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [{ name: "my_field", dataType: "Int32", nullable: false }],
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
            },
          });
        });

        const publisher = yield* WingsClient.publisher({ topic });

        yield* publisher.push({ batch: makeTestBatch() });
        yield* publisher.push({ batch: makeTestBatch() });

        const stream = yield* WingsClient.fetch({
          topic,
          offset: 0n,
        });

        const batches = yield* stream.pipe(Stream.take(2), Stream.runCollect);

        expect(Chunk.size(batches)).toBe(2);

        const table = recordBatchToTable([...Chunk.toReadonlyArray(batches)]);
        const { rows } = arrowTableToRowColumns(table);

        // Should have 8 rows total (2 batches * 4 rows each)
        expect(rows).toHaveLength(8);
      }).pipe(Effect.provide(wingsLayer));
    }),
  );
});
