import { expect, layer } from "@effect/vitest";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect, Layer, Stream } from "effect";
import { customAlphabet } from "nanoid";

import { Arrow, PartitionValue, WingsClient } from "../src";
import { makeTestBatch } from "./helpers";

const makeTopicId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 12);

const wingsLayer = Layer.effect(WingsClient.WingsClient)(
  Effect.gen(function* () {
    const w = yield* TestWings.Instance;
    const host = yield* w.grpcHostAndPort;
    return yield* WingsClient.make({
      host,
      namespace: "tenants/default/namespaces/default",
    });
  }),
);

const testLayer = wingsLayer.pipe(Layer.provide(TestWings.container));

layer(testLayer, { timeout: "30 seconds" })("Fetcher", (it) => {
  it.effect("should fetch data without partition key", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterClient;

          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [{ name: "my_field", dataType: "Int32", nullable: false, id: 1n }],
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
              targetFileSizeBytes: BigInt(1024 * 1024),
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

        const table = Arrow.recordBatchToTable([...batches]);
        const { columns, rows } = Arrow.arrowTableToRowColumns(table);

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
      }),
      "30 second",
    ),
  );

  // TODO: check the issue on wings server side
  it.effect.skip("should fetch data with partition key", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterClient;
          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [
              { name: "my_field", dataType: "Int32", nullable: false, id: 1n },
              { name: "my_part", dataType: "Int32", nullable: false, id: 2n },
            ],
            partitionKey: 2n,
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
              targetFileSizeBytes: BigInt(1024 * 1024),
            },
          });
        });

        const publisher = yield* WingsClient.publisher({ topic });

        yield* publisher.push({
          batch: makeTestBatch({ partitionValue: 1000 }),
          partitionValue: PartitionValue.int32(1000),
        });
        yield* publisher.push({
          batch: makeTestBatch({ partitionValue: 2000 }),
          partitionValue: PartitionValue.int32(2000),
        });

        const streamP1 = yield* WingsClient.fetch({
          topic,
          partitionValue: PartitionValue.int32(1000),
          offset: 0n,
        });

        const batchesP1 = yield* streamP1.pipe(Stream.take(1), Stream.runCollect);

        const tableP1 = Arrow.recordBatchToTable([...batchesP1]);
        const { rows: rowsP1 } = Arrow.arrowTableToRowColumns(tableP1);

        expect(rowsP1).toMatchObject([
          { __offset__: 0n, my_field: 1, my_part: 1000 },
          { __offset__: 1n, my_field: 2, my_part: 1000 },
          { __offset__: 2n, my_field: 3, my_part: 1000 },
          { __offset__: 3n, my_field: 4, my_part: 1000 },
        ]);

        const streamP2 = yield* WingsClient.fetch({
          topic,
          partitionValue: PartitionValue.int32(2000),
          offset: 0n,
        });

        const batchesP2 = yield* streamP2.pipe(Stream.take(1), Stream.runCollect);

        const tableP2 = Arrow.recordBatchToTable([...batchesP2]);
        const { rows: rowsP2 } = Arrow.arrowTableToRowColumns(tableP2);

        expect(rowsP2).toMatchObject([
          { __offset__: 0n, my_field: 1, my_part: 2000 },
          { __offset__: 1n, my_field: 2, my_part: 2000 },
          { __offset__: 2n, my_field: 3, my_part: 2000 },
          { __offset__: 3n, my_field: 4, my_part: 2000 },
        ]);
      }),
      "30 second",
    ),
  );

  it.effect("should handle stream operations", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterClient;
          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [{ name: "my_field", dataType: "Int32", nullable: false, id: 1n }],
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
              targetFileSizeBytes: BigInt(1024 * 1024),
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

        expect(batches.length).toBeGreaterThan(0);
        const firstBatch = batches[0];
        expect(firstBatch.numRows).toBeGreaterThan(0);
      }),
      "30 second",
    ),
  );

  it.effect("should fetch from specific offset", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();
        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterClient;
          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [{ name: "my_field", dataType: "Int32", nullable: false, id: 1n }],
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
              targetFileSizeBytes: BigInt(1024 * 1024),
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

        const table = Arrow.recordBatchToTable([...batches]);
        const { rows } = Arrow.arrowTableToRowColumns(table);

        // Should start from offset 2
        expect(rows[0].__offset__).toBeGreaterThanOrEqual(2n);
      }),
      "30 second",
    ),
  );

  it.effect("should push and fetch in the same program", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();

        const topic = yield* Effect.gen(function* () {
          const cm = yield* WingsClient.clusterClient;
          return yield* cm.createTopic({
            parent: "tenants/default/namespaces/default",
            topicId,
            fields: [{ name: "my_field", dataType: "Int32", nullable: false, id: 1n }],
            compaction: {
              freshnessSeconds: BigInt(1000),
              ttlSeconds: undefined,
              targetFileSizeBytes: BigInt(1024 * 1024),
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

        expect(batches.length).toBe(2);

        const table = Arrow.recordBatchToTable([...batches]);
        const { rows } = Arrow.arrowTableToRowColumns(table);

        // Should have 8 rows total (2 batches * 4 rows each)
        expect(rows).toHaveLength(8);
      }),
      "30 second",
    ),
  );
});
