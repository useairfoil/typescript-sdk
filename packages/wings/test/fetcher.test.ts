import { expect, layer } from "@effect/vitest";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect, Layer, Stream } from "effect";

import { Arrow, ClusterClient, PartitionValue, WingsClient } from "../src";
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

layer(testLayer, { timeout: "120 seconds" })("Fetcher", (it) => {
  it.effect.skip("should fetch data without partition key", () =>
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

        yield* publisher.push({ batch: makeTestBatch() });
        yield* publisher.push({ batch: makeTestBatch() });

        const stream = yield* WingsClient.fetch({ table, offset: 0n });
        const batches = yield* stream.pipe(Stream.take(2), Stream.runCollect);

        const arrowTable = Arrow.recordBatchToTable([...batches]);
        const { rows } = Arrow.arrowTableToRowColumns(arrowTable);

        expect(rows.length).toBeGreaterThanOrEqual(8);
        expect(rows[0]).toMatchObject({ my_field: 1 });
        expect(rows[1]).toMatchObject({ my_field: 2 });
      }),
      "90 seconds",
    ),
  );

  it.effect.skip("should fetch data with partition key", () =>
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

        yield* publisher.push({
          batch: makeTestBatch({ partitionValue: 1000 }),
          partitionValue: PartitionValue.int32(1000),
        });
        yield* publisher.push({
          batch: makeTestBatch({ partitionValue: 2000 }),
          partitionValue: PartitionValue.int32(2000),
        });

        const streamP1 = yield* WingsClient.fetch({
          table,
          partitionValue: PartitionValue.int32(1000),
          offset: 0n,
        });

        const batchesP1 = yield* streamP1.pipe(Stream.take(1), Stream.runCollect);
        const tableP1 = Arrow.recordBatchToTable([...batchesP1]);
        const { rows: rowsP1 } = Arrow.arrowTableToRowColumns(tableP1);

        expect(rowsP1).toMatchObject([
          { __offset__: 0n, my_field: 1 },
          { __offset__: 1n, my_field: 2 },
          { __offset__: 2n, my_field: 3 },
          { __offset__: 3n, my_field: 4 },
        ]);

        const streamP2 = yield* WingsClient.fetch({
          table,
          partitionValue: PartitionValue.int32(2000),
          offset: 0n,
        });

        const batchesP2 = yield* streamP2.pipe(Stream.take(1), Stream.runCollect);
        const tableP2 = Arrow.recordBatchToTable([...batchesP2]);
        const { rows: rowsP2 } = Arrow.arrowTableToRowColumns(tableP2);

        expect(rowsP2).toMatchObject([
          { __offset__: 0n, my_field: 1 },
          { __offset__: 1n, my_field: 2 },
          { __offset__: 2n, my_field: 3 },
          { __offset__: 3n, my_field: 4 },
        ]);
      }),
      "90 seconds",
    ),
  );
  it.effect.skip("should handle stream operations", () =>
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
        yield* publisher.push({ batch: makeTestBatch() });

        const stream = yield* WingsClient.fetch({ table, offset: 0n });
        const batches = yield* stream.pipe(
          Stream.filter((batch) => batch.numRows > 0),
          Stream.take(1),
          Stream.runCollect,
        );

        expect(batches.length).toBeGreaterThan(0);
        expect(batches[0]!.numRows).toBeGreaterThan(0);
      }),
      "90 seconds",
    ),
  );

  it.effect.skip("should fetch from specific offset", () =>
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
        yield* publisher.push({ batch: makeTestBatch() }); // Offsets 0-3

        const stream = yield* WingsClient.fetch({ table, offset: 2n });
        const batches = yield* stream.pipe(Stream.take(1), Stream.runCollect);

        const arrowTable = Arrow.recordBatchToTable([...batches]);
        const { rows } = Arrow.arrowTableToRowColumns(arrowTable);

        expect(rows[0]!.__offset__).toBeGreaterThanOrEqual(2n);
      }),
      "90 seconds",
    ),
  );

  it.effect.skip("should push and fetch in the same program", () =>
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

        yield* publisher.push({ batch: makeTestBatch() });
        yield* publisher.push({ batch: makeTestBatch() });

        const stream = yield* WingsClient.fetch({ table, offset: 0n });
        const batches = yield* stream.pipe(Stream.take(2), Stream.runCollect);

        expect(batches.length).toBe(2);

        const arrowTable = Arrow.recordBatchToTable([...batches]);
        const { rows } = Arrow.arrowTableToRowColumns(arrowTable);

        expect(rows).toHaveLength(8);
      }),
      "90 seconds",
    ),
  );
});
