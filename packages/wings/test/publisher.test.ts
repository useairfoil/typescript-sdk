import { expect, layer } from "@effect/vitest";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect, Layer } from "effect";
import { customAlphabet } from "nanoid";

import { PartitionValue, WingsClient } from "../src";
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

layer(testLayer, { timeout: "30 seconds" })("Publisher", (it) => {
  it.effect("should push data without partition values", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();
        const results = yield* Effect.gen(function* () {
          const topic = yield* Effect.gen(function* () {
            const cm = yield* WingsClient.clusterClient;
            return yield* cm.createTopic({
              parent: "tenants/default/namespaces/default",
              topicId,
              fields: [{ name: "my_field", dataType: "Int32", nullable: false, id: 1n }],
              compaction: {
                freshnessSeconds: BigInt(1000),
                ttlSeconds: undefined,
                targetFileSizeBytes: BigInt(5 * 1024 * 1024),
              },
            });
          });

          const publisher = yield* WingsClient.publisher({ topic });

          const b0 = publisher.push({ batch: makeTestBatch() });
          const b1 = publisher.push({ batch: makeTestBatch() });
          const b2 = publisher.push({ batch: makeTestBatch() });

          return yield* Effect.all([b0, b1, b2], {
            concurrency: "unbounded",
          });
        });

        expect(results[0]).toMatchObject({
          $type: "wings.v1.log_metadata.CommittedBatch",
          result: {
            $case: "accepted",
            accepted: {
              $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
              endOffset: 3n,
              startOffset: 0n,
            },
          },
        });

        expect(results[1]).toMatchObject({
          $type: "wings.v1.log_metadata.CommittedBatch",
          result: {
            $case: "accepted",
            accepted: {
              $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
              endOffset: 7n,
              startOffset: 4n,
            },
          },
        });

        expect(results[2]).toMatchObject({
          $type: "wings.v1.log_metadata.CommittedBatch",
          result: {
            $case: "accepted",
            accepted: {
              $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
              endOffset: 11n,
              startOffset: 8n,
            },
          },
        });
      }),
      "30 second",
    ),
  );

  it.effect("should push data with partition values", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();

        const results = yield* Effect.gen(function* () {
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

          const b0 = publisher.push({
            batch: makeTestBatch({ partitionValue: 1000 }),
            partitionValue: PartitionValue.int32(1000),
          });
          const b1 = publisher.push({
            batch: makeTestBatch({ partitionValue: 2000 }),
            partitionValue: PartitionValue.int32(2000),
          });
          const b2 = publisher.push({
            batch: makeTestBatch({ partitionValue: 3000 }),
            partitionValue: PartitionValue.int32(3000),
          });

          return yield* Effect.all([b0, b1, b2], {
            concurrency: "unbounded",
          });
        });

        expect(results[0]).toMatchObject({
          $type: "wings.v1.log_metadata.CommittedBatch",
          result: {
            $case: "accepted",
            accepted: {
              $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
              endOffset: 3n,
              startOffset: 0n,
            },
          },
        });

        expect(results[1]).toMatchObject({
          $type: "wings.v1.log_metadata.CommittedBatch",
          result: {
            $case: "accepted",
            accepted: {
              $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
              endOffset: 3n,
              startOffset: 0n,
            },
          },
        });

        expect(results[2]).toMatchObject({
          $type: "wings.v1.log_metadata.CommittedBatch",
          result: {
            $case: "accepted",
            accepted: {
              $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
              endOffset: 3n,
              startOffset: 0n,
            },
          },
        });
      }),
      "30 second",
    ),
  );

  it.effect("should use default partition value", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();

        const results = yield* Effect.gen(function* () {
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

          const publisher = yield* WingsClient.publisher({
            topic,
            partitionValue: PartitionValue.int32(5000),
          });

          const b0 = publisher.push({
            batch: makeTestBatch({ partitionValue: 5000 }),
          });

          const b1 = publisher.push({
            batch: makeTestBatch({ partitionValue: 6000 }),
            partitionValue: PartitionValue.int32(6000),
          });

          return yield* Effect.all([b0, b1], { concurrency: "unbounded" });
        });

        expect(results[0].result?.$case).toBe("accepted");
        expect(results[1].result?.$case).toBe("accepted");
      }),
      "30 second",
    ),
  );

  it.effect("should handle concurrent pushes", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const topicId = makeTopicId();

        const results = yield* Effect.gen(function* () {
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

          const pushes = Array.from({ length: 10 }, () =>
            publisher.push({ batch: makeTestBatch() }),
          );

          return yield* Effect.all(pushes, { concurrency: "unbounded" });
        });

        expect(results).toHaveLength(10);
        for (const result of results) {
          expect(result.result?.$case).toBe("accepted");
        }
      }),
      "30 second",
    ),
  );
});
