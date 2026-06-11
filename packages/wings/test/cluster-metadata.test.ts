import { describe, expect, layer } from "@effect/vitest";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect, Exit, Layer } from "effect";

import { ClusterClient } from "../src";
import * as ClusterSchema from "../src/cluster";
import { makeId, TEST_LAKE, TEST_OBJECT_STORE } from "./helpers";

const clusterLayer = Layer.effect(ClusterClient.ClusterClient)(
  Effect.gen(function* () {
    const w = yield* TestWings.Instance;
    const host = yield* w.grpcHostAndPort;
    return yield* ClusterClient.make({ host });
  }),
);

// One container is shared across all tests
const testLayer = clusterLayer.pipe(Layer.provide(TestWings.container));

layer(testLayer, { timeout: "120 seconds" })("ClusterMetadata", (it) => {
  describe("Namespace Operations", () => {
    it.effect("should create a namespace", () =>
      Effect.gen(function* () {
        const namespaceId = makeId();

        const namespace = yield* ClusterClient.createNamespace({
          namespaceId,
          objectStore: TEST_OBJECT_STORE,
          lake: TEST_LAKE,
        });

        expect(namespace.name).toBe(`namespaces/${namespaceId}`);
        const { name: _name, ...rest } = namespace;
        expect(rest).toMatchInlineSnapshot(`
          {
            "lake": {
              "lakeConfig": {
                "_tag": "parquet",
                "parquet": {},
              },
            },
            "objectStore": {
              "objectStoreConfig": {
                "_tag": "s3Compatible",
                "s3Compatible": {
                  "accessKeyId": "********",
                  "allowHttp": true,
                  "bucketName": "default-bucket",
                  "endpoint": "http://seaweedfs:8333",
                  "prefix": undefined,
                  "region": "us-east-1",
                  "secretAccessKey": "********",
                },
              },
            },
          }
        `);
      }),
    );

    it.effect("should get a namespace", () =>
      Effect.gen(function* () {
        const namespaceId = makeId();

        yield* ClusterClient.createNamespace({
          namespaceId,
          objectStore: TEST_OBJECT_STORE,
          lake: TEST_LAKE,
        });

        const namespace = yield* ClusterClient.getNamespace({
          name: `namespaces/${namespaceId}`,
        });

        expect(namespace.name).toBe(`namespaces/${namespaceId}`);
        const { name: _name, ...rest } = namespace;
        expect(rest).toMatchInlineSnapshot(`
          {
            "lake": {
              "lakeConfig": {
                "_tag": "parquet",
                "parquet": {},
              },
            },
            "objectStore": {
              "objectStoreConfig": {
                "_tag": "s3Compatible",
                "s3Compatible": {
                  "accessKeyId": "********",
                  "allowHttp": true,
                  "bucketName": "default-bucket",
                  "endpoint": "http://seaweedfs:8333",
                  "prefix": undefined,
                  "region": "us-east-1",
                  "secretAccessKey": "********",
                },
              },
            },
          }
        `);
      }),
    );

    it.effect("should list namespaces", () =>
      Effect.gen(function* () {
        yield* ClusterClient.createNamespace({
          namespaceId: makeId(),
          objectStore: TEST_OBJECT_STORE,
          lake: TEST_LAKE,
        });

        const response = yield* ClusterClient.listNamespaces({});

        expect(response).toHaveProperty("namespaces");
        expect(Array.isArray(response.namespaces)).toBe(true);
        expect(response.namespaces.length).toBeGreaterThan(0);
        for (const ns of response.namespaces) {
          expect(ns.name).toBeTruthy();
        }
      }),
    );

    it.effect("should delete a namespace", () =>
      Effect.gen(function* () {
        const namespaceId = makeId();

        yield* ClusterClient.createNamespace({
          namespaceId,
          objectStore: TEST_OBJECT_STORE,
          lake: TEST_LAKE,
        });

        yield* ClusterClient.deleteNamespace({ name: `namespaces/${namespaceId}` });

        const exit = yield* Effect.exit(
          ClusterClient.getNamespace({ name: `namespaces/${namespaceId}` }),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }),
    );

    it.effect("should handle namespace not found error", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          ClusterClient.getNamespace({ name: "namespaces/nonexistent" }),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }),
    );
  });

  describe("Table Operations", () => {
    it.effect("should create a table", () =>
      Effect.gen(function* () {
        const namespaceId = makeId();
        const tableId = makeId();

        yield* ClusterClient.createNamespace({
          namespaceId,
          objectStore: TEST_OBJECT_STORE,
          lake: TEST_LAKE,
        });

        const table = yield* ClusterClient.createTable({
          parent: `namespaces/${namespaceId}`,
          tableId,
          fields: [
            { name: "id", dataType: "Int64", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          targetFreshnessSeconds: 3600n,
        });

        expect(table.name).toBe(`namespaces/${namespaceId}/tables/${tableId}`);
        const { name: _name, ...rest } = table;
        expect(rest).toMatchInlineSnapshot(`
          {
            "description": undefined,
            "keyFieldId": 1n,
            "partitionFieldId": undefined,
            "schema": {
              "fields": [
                {
                  "arrowType": {
                    "_tag": "int64",
                  },
                  "id": 1n,
                  "metadata": {},
                  "name": "id",
                  "nullable": false,
                },
                {
                  "arrowType": {
                    "_tag": "int32",
                  },
                  "id": 2n,
                  "metadata": {},
                  "name": "version",
                  "nullable": false,
                },
              ],
              "metadata": {},
            },
            "targetFreshnessSeconds": 0n,
            "versionFieldId": 2n,
          }
        `);
      }),
    );

    it.effect("should get a table", () =>
      Effect.gen(function* () {
        const namespaceId = makeId();
        const tableId = makeId();

        yield* ClusterClient.createNamespace({
          namespaceId,
          objectStore: TEST_OBJECT_STORE,
          lake: TEST_LAKE,
        });

        yield* ClusterClient.createTable({
          parent: `namespaces/${namespaceId}`,
          tableId,
          fields: [
            { name: "id", dataType: "Int64", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          targetFreshnessSeconds: 3600n,
        });

        const table = yield* ClusterClient.getTable({
          name: `namespaces/${namespaceId}/tables/${tableId}`,
        });

        expect(table.name).toBe(`namespaces/${namespaceId}/tables/${tableId}`);
        const { name: _name, ...rest } = table;
        expect(rest).toMatchInlineSnapshot(`
          {
            "description": undefined,
            "keyFieldId": 1n,
            "partitionFieldId": undefined,
            "schema": {
              "fields": [
                {
                  "arrowType": {
                    "_tag": "int64",
                  },
                  "id": 1n,
                  "metadata": {},
                  "name": "id",
                  "nullable": false,
                },
                {
                  "arrowType": {
                    "_tag": "int32",
                  },
                  "id": 2n,
                  "metadata": {},
                  "name": "version",
                  "nullable": false,
                },
              ],
              "metadata": {},
            },
            "targetFreshnessSeconds": 0n,
            "versionFieldId": 2n,
          }
        `);
      }),
    );

    it.effect("should list tables", () =>
      Effect.gen(function* () {
        const namespaceId = makeId();

        yield* ClusterClient.createNamespace({
          namespaceId,
          objectStore: TEST_OBJECT_STORE,
          lake: TEST_LAKE,
        });

        yield* ClusterClient.createTable({
          parent: `namespaces/${namespaceId}`,
          tableId: makeId(),
          fields: [
            { name: "id", dataType: "Int64", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          targetFreshnessSeconds: 3600n,
        });

        const response = yield* ClusterClient.listTables({
          parent: `namespaces/${namespaceId}`,
        });

        expect(response).toHaveProperty("tables");
        expect(Array.isArray(response.tables)).toBe(true);
        expect(response.tables.length).toBe(1);
      }),
    );

    it.effect("should delete a table", () =>
      Effect.gen(function* () {
        const namespaceId = makeId();
        const tableId = makeId();

        yield* ClusterClient.createNamespace({
          namespaceId,
          objectStore: TEST_OBJECT_STORE,
          lake: TEST_LAKE,
        });

        yield* ClusterClient.createTable({
          parent: `namespaces/${namespaceId}`,
          tableId,
          fields: [
            { name: "id", dataType: "Int64", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          targetFreshnessSeconds: 3600n,
        });

        yield* ClusterClient.deleteTable({
          name: `namespaces/${namespaceId}/tables/${tableId}`,
        });

        const exit = yield* Effect.exit(
          ClusterClient.getTable({
            name: `namespaces/${namespaceId}/tables/${tableId}`,
          }),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }),
    );
  });

  describe("Error Handling", () => {
    it.effect("should handle connection errors gracefully", () => {
      const errorLayer = ClusterClient.layer({ host: "localhost:9999" });
      return Effect.gen(function* () {
        const exit = yield* Effect.exit(ClusterClient.listNamespaces({}));
        expect(Exit.isFailure(exit)).toBe(true);
      }).pipe(Effect.provide(errorLayer));
    });

    it.effect("should catch ClusterClientError with Effect.catchTag", () =>
      Effect.gen(function* () {
        const result = yield* ClusterClient.getNamespace({
          name: "namespaces/nonexistent",
        }).pipe(
          Effect.catchTag("ClusterClientError", (error) =>
            Effect.succeed({ name: "fallback", error: error.message }),
          ),
        );

        expect(result).toMatchInlineSnapshot(`
          {
            "error": "/wings.cluster.ClusterService/GetNamespace NOT_FOUND: Object at namespaces/nonexistent/manifest.json not found",
            "name": "fallback",
          }
        `);
      }),
    );
  });

  describe("Schema Codecs", () => {
    it.effect("should correctly encode and decode namespace schemas", () =>
      Effect.sync(() => {
        const createRequest: ClusterSchema.Namespace.CreateNamespaceRequest = {
          namespaceId: "test-ns",
          objectStore: {
            objectStoreConfig: {
              _tag: "s3Compatible" as const,
              s3Compatible: {
                bucketName: "default-bucket",
                endpoint: "http://seaweedfs:8333",
                region: "us-east-1",
                accessKeyId: "wingsdevaccesskey",
                secretAccessKey: "wingsdevsecretkey",
                allowHttp: true,
              },
            },
          },
          lake: { lakeConfig: { _tag: "parquet" as const, parquet: {} } },
        };

        const protoRequest =
          ClusterSchema.Namespace.Codec.CreateNamespaceRequest.toProto(createRequest);
        expect(protoRequest).toMatchInlineSnapshot(`
          {
            "$type": "wings.cluster.CreateNamespaceRequest",
            "namespace": {
              "$type": "wings.cluster.Namespace",
              "lake": {
                "$type": "wings.cluster.Lake",
                "lakeConfig": {
                  "$case": "parquet",
                  "parquet": {
                    "$type": "wings.cluster.ParquetConfiguration",
                  },
                },
              },
              "name": "namespaces/test-ns",
              "objectStore": {
                "$type": "wings.cluster.ObjectStore",
                "objectStoreConfig": {
                  "$case": "s3Compatible",
                  "s3Compatible": {
                    "$type": "wings.cluster.S3CompatibleConfiguration",
                    "accessKeyId": "wingsdevaccesskey",
                    "allowHttp": true,
                    "bucketName": "default-bucket",
                    "endpoint": "http://seaweedfs:8333",
                    "prefix": undefined,
                    "region": "us-east-1",
                    "secretAccessKey": "wingsdevsecretkey",
                  },
                },
              },
            },
            "namespaceId": "test-ns",
          }
        `);

        const decoded =
          ClusterSchema.Namespace.Codec.CreateNamespaceRequest.fromProto(protoRequest);
        expect(decoded).toMatchInlineSnapshot(`
          {
            "lake": {
              "lakeConfig": {
                "_tag": "parquet",
                "parquet": {},
              },
            },
            "namespaceId": "test-ns",
            "objectStore": {
              "objectStoreConfig": {
                "_tag": "s3Compatible",
                "s3Compatible": {
                  "accessKeyId": "wingsdevaccesskey",
                  "allowHttp": true,
                  "bucketName": "default-bucket",
                  "endpoint": "http://seaweedfs:8333",
                  "prefix": undefined,
                  "region": "us-east-1",
                  "secretAccessKey": "wingsdevsecretkey",
                },
              },
            },
          }
        `);
      }),
    );

    it.effect("should correctly encode and decode table schemas", () =>
      Effect.sync(() => {
        const createRequest: ClusterSchema.Table.CreateTableRequest = {
          parent: "namespaces/test",
          tableId: "my-table",
          fields: [
            { name: "id", dataType: "Int64", nullable: false, id: 1n },
            { name: "version", dataType: "Int32", nullable: false, id: 2n },
            { name: "name", dataType: "Utf8", nullable: true, id: 3n },
          ],
          keyFieldId: 1n,
          versionFieldId: 2n,
          targetFreshnessSeconds: 3600n,
        };

        const protoRequest = ClusterSchema.Table.Codec.CreateTableRequest.toProto(createRequest);
        expect(protoRequest).toMatchInlineSnapshot(`
          {
            "$type": "wings.cluster.CreateTableRequest",
            "parent": "namespaces/test",
            "table": {
              "$type": "wings.cluster.Table",
              "description": undefined,
              "keyFieldId": 1n,
              "name": "namespaces/test/tables/my-table",
              "partitionFieldId": undefined,
              "schema": {
                "$type": "wings.schema.Schema",
                "fields": [
                  {
                    "$type": "wings.schema.Field",
                    "arrowType": {
                      "$type": "wings.schema.ArrowType",
                      "arrowTypeEnum": {
                        "$case": "int64",
                        "int64": {
                          "$type": "wings.schema.EmptyMessage",
                        },
                      },
                    },
                    "id": 1n,
                    "metadata": Map {},
                    "name": "id",
                    "nullable": false,
                  },
                  {
                    "$type": "wings.schema.Field",
                    "arrowType": {
                      "$type": "wings.schema.ArrowType",
                      "arrowTypeEnum": {
                        "$case": "int32",
                        "int32": {
                          "$type": "wings.schema.EmptyMessage",
                        },
                      },
                    },
                    "id": 2n,
                    "metadata": Map {},
                    "name": "version",
                    "nullable": false,
                  },
                  {
                    "$type": "wings.schema.Field",
                    "arrowType": {
                      "$type": "wings.schema.ArrowType",
                      "arrowTypeEnum": {
                        "$case": "utf8",
                        "utf8": {
                          "$type": "wings.schema.EmptyMessage",
                        },
                      },
                    },
                    "id": 3n,
                    "metadata": Map {},
                    "name": "name",
                    "nullable": true,
                  },
                ],
                "metadata": Map {},
              },
              "targetFreshnessSeconds": 3600n,
              "versionFieldId": 2n,
            },
            "tableId": "my-table",
          }
        `);

        const decoded = ClusterSchema.Table.Codec.CreateTableRequest.fromProto(protoRequest);
        expect(decoded).toMatchInlineSnapshot(`
          {
            "description": undefined,
            "fields": [
              {
                "dataType": "Int64",
                "id": 1n,
                "name": "id",
                "nullable": false,
              },
              {
                "dataType": "Int32",
                "id": 2n,
                "name": "version",
                "nullable": false,
              },
              {
                "dataType": "Utf8",
                "id": 3n,
                "name": "name",
                "nullable": true,
              },
            ],
            "keyFieldId": 1n,
            "parent": "namespaces/test",
            "partitionFieldId": undefined,
            "tableId": "my-table",
            "targetFreshnessSeconds": 3600n,
            "versionFieldId": 2n,
          }
        `);
      }),
    );
  });
});
