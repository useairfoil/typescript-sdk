import { expect, layer } from "@effect/vitest";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect, Layer } from "effect";

import { ClusterClient, PartitionValue, WingsClient } from "../src";
import { makeId, makeTestBatch, TEST_OBJECT_STORE } from "./helpers";

// Namespace name is stored here after creation in wingsLayer
let testNamespace = "";

const wingsLayer = Layer.effect(WingsClient.WingsClient)(
  Effect.gen(function* () {
    const w = yield* TestWings.Instance;
    const host = yield* w.grpcHostAndPort;

    const cc = yield* ClusterClient.make({ host });
    const namespaceId = makeId();
    yield* cc.createNamespace({
      namespaceId,
      objectStore: TEST_OBJECT_STORE,
      lake: { lakeConfig: { _tag: "parquet" as const, parquet: {} } },
    });
    testNamespace = `namespaces/${namespaceId}`;

    return yield* WingsClient.make({ host, namespace: testNamespace });
  }),
);

const testLayer = wingsLayer.pipe(Layer.provide(TestWings.container));

layer(testLayer, { timeout: "120 seconds" })("Publisher", (it) => {
  it.effect("should push data without partition values", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const tableId = makeId();
        const cm = yield* WingsClient.clusterClient;
        const table = yield* cm.createTable({
          parent: testNamespace,
          tableId,
          fields: [
            { name: "my_field", dataType: "Int32", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          targetFreshnessSeconds: 1000n,
        });

        const publisher = yield* WingsClient.publisher({ table });

        const b0 = publisher.push({ batch: makeTestBatch() });
        const b1 = publisher.push({ batch: makeTestBatch() });
        const b2 = publisher.push({ batch: makeTestBatch() });

        const results = yield* Effect.all([b0, b1, b2], { concurrency: "unbounded" });

        expect(results[0]).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
        expect(results[1]).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
        expect(results[2]).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
      }),
      "90 seconds",
    ),
  );

  it.effect("should push data with partition values", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const tableId = makeId();
        const cm = yield* WingsClient.clusterClient;
        const table = yield* cm.createTable({
          parent: testNamespace,
          tableId,
          fields: [
            { name: "my_field", dataType: "Int32", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
            { name: "my_part", dataType: "Int32", nullable: false, id: 3n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          partitionFieldId: 3n,
          targetFreshnessSeconds: 1000n,
        });

        const publisher = yield* WingsClient.publisher({ table });

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

        const results = yield* Effect.all([b0, b1, b2], { concurrency: "unbounded" });

        expect(results[0]).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
        expect(results[1]).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
        expect(results[2]).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
      }),
      "90 seconds",
    ),
  );

  it.effect("should use default partition value", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const tableId = makeId();
        const cm = yield* WingsClient.clusterClient;
        const table = yield* cm.createTable({
          parent: testNamespace,
          tableId,
          fields: [
            { name: "my_field", dataType: "Int32", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
            { name: "my_part", dataType: "Int32", nullable: false, id: 3n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          partitionFieldId: 3n,
          targetFreshnessSeconds: 1000n,
        });

        const publisher = yield* WingsClient.publisher({
          table,
          partitionValue: PartitionValue.int32(5000),
        });

        const b0 = publisher.push({ batch: makeTestBatch({ partitionValue: 5000 }) });
        const b1 = publisher.push({
          batch: makeTestBatch({ partitionValue: 6000 }),
          partitionValue: PartitionValue.int32(6000),
        });

        const results = yield* Effect.all([b0, b1], { concurrency: "unbounded" });

        expect(results[0]).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
        expect(results[1]).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
      }),
      "90 seconds",
    ),
  );

  it.effect("should push delete mutations", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const tableId = makeId();
        const cm = yield* WingsClient.clusterClient;
        const table = yield* cm.createTable({
          parent: testNamespace,
          tableId,
          fields: [
            { name: "my_field", dataType: "Int32", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
            { name: "payload", dataType: "Int32", nullable: false, id: 3n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          targetFreshnessSeconds: 1000n,
        });

        const publisher = yield* WingsClient.publisher({ table });
        const result = yield* publisher.push({
          operation: "delete",
          batch: makeTestBatch(),
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "accepted": true,
            "message": "",
          }
        `);
      }),
      "90 seconds",
    ),
  );

  it.effect("should handle concurrent pushes", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const tableId = makeId();
        const cm = yield* WingsClient.clusterClient;
        const table = yield* cm.createTable({
          parent: testNamespace,
          tableId,
          fields: [
            { name: "my_field", dataType: "Int32", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          targetFreshnessSeconds: 1000n,
        });

        const publisher = yield* WingsClient.publisher({ table });

        const pushes = Array.from({ length: 10 }, () => publisher.push({ batch: makeTestBatch() }));

        const results = yield* Effect.all(pushes, { concurrency: "unbounded" });

        expect(results).toHaveLength(10);
        for (const result of results) {
          expect(result).toMatchInlineSnapshot(`
            {
              "accepted": true,
              "message": "",
            }
          `);
        }
      }),
      "90 seconds",
    ),
  );
});
