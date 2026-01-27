import { WingsContainer } from "@airfoil/flight/test";
import { expect, it as vitest } from "@effect/vitest";
import { Effect } from "effect";
import { customAlphabet } from "nanoid";
import { afterAll, beforeAll, describe } from "vitest";
import { PV, WingsClient } from "../src";
import { makeTestBatch } from "./helpers";

const makeTopicId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 12);

describe("Publisher (Effect)", () => {
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

  vitest.effect("should push data without partition values", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      const results = yield* Effect.gen(function* () {
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

        const b0 = publisher.push({ batch: makeTestBatch() });
        const b1 = publisher.push({ batch: makeTestBatch() });
        const b2 = publisher.push({ batch: makeTestBatch() });

        return yield* Effect.all([b0, b1, b2], {
          concurrency: "unbounded",
        });
      }).pipe(Effect.provide(wingsLayer));

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
  );

  vitest.effect("should push data with partition values", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      const results = yield* Effect.gen(function* () {
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

        const b0 = publisher.push({
          batch: makeTestBatch(),
          partitionValue: PV.int32(1000),
        });
        const b1 = publisher.push({
          batch: makeTestBatch(),
          partitionValue: PV.int32(2000),
        });
        const b2 = publisher.push({
          batch: makeTestBatch(),
          partitionValue: PV.int32(3000),
        });

        return yield* Effect.all([b0, b1, b2], {
          concurrency: "unbounded",
        });
      }).pipe(Effect.provide(wingsLayer));

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
  );

  vitest.effect("should use default partition value", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      const results = yield* Effect.gen(function* () {
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

        const publisher = yield* WingsClient.publisher({
          topic,
          partitionValue: PV.int32(5000),
        });

        const b0 = publisher.push({ batch: makeTestBatch() });

        const b1 = publisher.push({
          batch: makeTestBatch(),
          partitionValue: PV.int32(6000),
        });

        return yield* Effect.all([b0, b1], { concurrency: "unbounded" });
      }).pipe(Effect.provide(wingsLayer));

      expect(results[0].result?.$case).toBe("accepted");
      expect(results[1].result?.$case).toBe("accepted");
    }),
  );

  vitest.effect("should handle concurrent pushes", () =>
    Effect.gen(function* () {
      if (!wingsContainer) {
        return yield* Effect.fail("Wings container not initialized");
      }

      const topicId = makeTopicId();

      const wingsLayer = WingsClient.layer({
        host: wingsContainer.getGrpcHost(),
        namespace: "tenants/default/namespaces/default",
      });

      const results = yield* Effect.gen(function* () {
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

        const pushes = Array.from({ length: 10 }, () =>
          publisher.push({ batch: makeTestBatch() }),
        );

        return yield* Effect.all(pushes, { concurrency: "unbounded" });
      }).pipe(Effect.provide(wingsLayer));

      expect(results).toHaveLength(10);
      for (const result of results) {
        expect(result.result?.$case).toBe("accepted");
      }
    }),
  );
});
