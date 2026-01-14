import { WingsContainer } from "@airfoil/flight/test";
import { expect, it as vitest } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { customAlphabet } from "nanoid";
import { afterAll, beforeAll, describe, it } from "vitest";
import { WingsClusterMetadata } from "../../src/effect";
import * as TenantSchemas from "../../src/effect/schemas/tenant";
import * as TopicSchemas from "../../src/effect/schemas/topic";

const makeId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 12);

describe("ClusterMetadata (Effect)", () => {
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

  describe("Layer Configuration", () => {
    vitest.effect("should create layer with direct config", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const program = WingsClusterMetadata.listTenants({ pageSize: 10 });

        const result = yield* Effect.provide(program, layer);
        expect(result).toHaveProperty("tenants");
        expect(Array.isArray(result.tenants)).toBe(true);
      }),
    );
  });

  describe("Tenant Operations", () => {
    vitest.effect("should create a tenant", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();

        const tenant = yield* WingsClusterMetadata.createTenant({
          tenantId,
        }).pipe(Effect.provide(layer));

        expect(tenant.name).toBe(`tenants/${tenantId}`);
      }),
    );

    vitest.effect("should get a tenant", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        const tenant = yield* WingsClusterMetadata.getTenant({
          name: `tenants/${tenantId}`,
        }).pipe(Effect.provide(layer));

        expect(tenant.name).toBe(`tenants/${tenantId}`);
      }),
    );

    vitest.effect("should list tenants", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const response = yield* WingsClusterMetadata.listTenants({
          pageSize: 100,
        }).pipe(Effect.provide(layer));

        expect(response).toHaveProperty("tenants");
        expect(Array.isArray(response.tenants)).toBe(true);
      }),
    );

    vitest.effect("should delete a tenant", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        yield* WingsClusterMetadata.deleteTenant({
          name: `tenants/${tenantId}`,
        }).pipe(Effect.provide(layer));

        const exit = yield* Effect.exit(
          WingsClusterMetadata.getTenant({
            name: `tenants/${tenantId}`,
          }).pipe(Effect.provide(layer)),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }),
    );

    vitest.effect("should handle tenant not found error", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const exit = yield* Effect.exit(
          WingsClusterMetadata.getTenant({
            name: "tenants/nonexistent",
          }).pipe(Effect.provide(layer)),
        );

        expect(Exit.isFailure(exit)).toBe(true);

        if (Exit.isFailure(exit)) {
          const error = exit.cause;
          expect(error._tag).toBe("Fail");
        }
      }),
    );
  });

  describe("Namespace Operations", () => {
    vitest.effect("should create a namespace", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();
        const namespaceId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        const objectStoreId = makeId();

        yield* WingsClusterMetadata.createObjectStore({
          parent: `tenants/${tenantId}`,
          objectStoreId,
          objectStoreConfig: {
            _tag: "s3Compatible",
            s3Compatible: {
              bucketName: "test-bucket",
              endpoint: "http://localhost:9000",
              region: "us-east-1",
              accessKeyId: "test-access-key",
              secretAccessKey: "test-secret-key",
            },
          },
        }).pipe(Effect.provide(layer));

        const dataLakeId = makeId();
        yield* WingsClusterMetadata.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "parquet",
            parquet: {},
          },
        }).pipe(Effect.provide(layer));

        const namespace = yield* WingsClusterMetadata.createNamespace({
          parent: `tenants/${tenantId}`,
          namespaceId,
          flushSizeBytes: BigInt(1024 * 1024),
          flushIntervalMillis: BigInt(5000),
          objectStore: `tenants/${tenantId}/object-stores/${objectStoreId}`,
          dataLake: `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        }).pipe(Effect.provide(layer));

        expect(namespace.name).toBe(
          `tenants/${tenantId}/namespaces/${namespaceId}`,
        );
      }),
    );

    vitest.effect("should get a namespace", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();
        const namespaceId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        const objectStoreId = makeId();
        yield* WingsClusterMetadata.createObjectStore({
          parent: `tenants/${tenantId}`,
          objectStoreId,
          objectStoreConfig: {
            _tag: "s3Compatible",
            s3Compatible: {
              bucketName: "test-bucket",
              endpoint: "http://localhost:9000",
              region: "us-east-1",
              accessKeyId: "test-access-key",
              secretAccessKey: "test-secret-key",
            },
          },
        }).pipe(Effect.provide(layer));

        const dataLakeId = makeId();
        yield* WingsClusterMetadata.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "parquet",
            parquet: {},
          },
        }).pipe(Effect.provide(layer));

        yield* WingsClusterMetadata.createNamespace({
          parent: `tenants/${tenantId}`,
          namespaceId,
          flushSizeBytes: BigInt(1024 * 1024),
          flushIntervalMillis: BigInt(5000),
          objectStore: `tenants/${tenantId}/object-stores/${objectStoreId}`,
          dataLake: `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        }).pipe(Effect.provide(layer));

        const namespace = yield* WingsClusterMetadata.getNamespace({
          name: `tenants/${tenantId}/namespaces/${namespaceId}`,
        }).pipe(Effect.provide(layer));

        expect(namespace.name).toBe(
          `tenants/${tenantId}/namespaces/${namespaceId}`,
        );
      }),
    );

    vitest.effect("should list namespaces", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const response = yield* WingsClusterMetadata.listNamespaces({
          parent: "tenants/default",
          pageSize: 100,
        }).pipe(Effect.provide(layer));

        expect(response).toHaveProperty("namespaces");
        expect(Array.isArray(response.namespaces)).toBe(true);
      }),
    );
  });

  describe("Topic Operations", () => {
    vitest.effect("should create a topic", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const topicId = makeId();

        const topic = yield* WingsClusterMetadata.createTopic({
          parent: "tenants/default/namespaces/default",
          topicId,
          fields: [
            { name: "id", dataType: "Int32", nullable: false },
            { name: "name", dataType: "Utf8", nullable: true },
          ],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
          },
        }).pipe(Effect.provide(layer));

        expect(topic.name).toBe(
          `tenants/default/namespaces/default/topics/${topicId}`,
        );
      }),
    );

    vitest.effect("should get a topic", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const topicId = makeId();

        yield* WingsClusterMetadata.createTopic({
          parent: "tenants/default/namespaces/default",
          topicId,
          fields: [{ name: "field1", dataType: "Int32", nullable: false }],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
          },
        }).pipe(Effect.provide(layer));

        const topic = yield* WingsClusterMetadata.getTopic({
          name: `tenants/default/namespaces/default/topics/${topicId}`,
        }).pipe(Effect.provide(layer));

        expect(topic.name).toBe(
          `tenants/default/namespaces/default/topics/${topicId}`,
        );
        expect(topic.fields.length).toBeGreaterThan(0);
      }),
    );

    vitest.effect("should list topics", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const response = yield* WingsClusterMetadata.listTopics({
          parent: "tenants/default/namespaces/default",
          pageSize: 100,
        }).pipe(Effect.provide(layer));

        expect(response).toHaveProperty("topics");
        expect(Array.isArray(response.topics)).toBe(true);
      }),
    );

    vitest.effect("should delete a topic", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const topicId = makeId();

        yield* WingsClusterMetadata.createTopic({
          parent: "tenants/default/namespaces/default",
          topicId,
          fields: [{ name: "field1", dataType: "Int32", nullable: false }],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
          },
        }).pipe(Effect.provide(layer));

        yield* WingsClusterMetadata.deleteTopic({
          name: `tenants/default/namespaces/default/topics/${topicId}`,
          force: true,
        }).pipe(Effect.provide(layer));

        const exit = yield* Effect.exit(
          WingsClusterMetadata.getTopic({
            name: `tenants/default/namespaces/default/topics/${topicId}`,
          }).pipe(Effect.provide(layer)),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }),
    );
  });

  describe("Object Store Operations", () => {
    vitest.effect("should create an S3 object store", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();
        const objectStoreId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        const objectStore = yield* WingsClusterMetadata.createObjectStore({
          parent: `tenants/${tenantId}`,
          objectStoreId,
          objectStoreConfig: {
            _tag: "s3Compatible",
            s3Compatible: {
              bucketName: "test-bucket",
              endpoint: "http://localhost:9000",
              region: "us-east-1",
              accessKeyId: "test-access-key",
              secretAccessKey: "test-secret-key",
            },
          },
        }).pipe(Effect.provide(layer));

        expect(objectStore.name).toBe(
          `tenants/${tenantId}/object-stores/${objectStoreId}`,
        );
      }),
    );

    vitest.effect("should get an object store", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();
        const objectStoreId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        yield* WingsClusterMetadata.createObjectStore({
          parent: `tenants/${tenantId}`,
          objectStoreId,
          objectStoreConfig: {
            _tag: "s3Compatible",
            s3Compatible: {
              bucketName: "test-bucket",
              endpoint: "http://localhost:9000",
              region: "us-east-1",
              accessKeyId: "test-access-key",
              secretAccessKey: "test-secret-key",
            },
          },
        }).pipe(Effect.provide(layer));

        const objectStore = yield* WingsClusterMetadata.getObjectStore({
          name: `tenants/${tenantId}/object-stores/${objectStoreId}`,
        }).pipe(Effect.provide(layer));

        expect(objectStore.name).toBe(
          `tenants/${tenantId}/object-stores/${objectStoreId}`,
        );
      }),
    );

    vitest.effect("should list object stores", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const response = yield* WingsClusterMetadata.listObjectStores({
          parent: "tenants/default",
          pageSize: 100,
        }).pipe(Effect.provide(layer));

        expect(response).toHaveProperty("objectStores");
        expect(Array.isArray(response.objectStores)).toBe(true);
      }),
    );
  });

  describe("Data Lake Operations", () => {
    vitest.effect("should create a Parquet data lake", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();
        const dataLakeId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        const dataLake = yield* WingsClusterMetadata.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "parquet",
            parquet: {},
          },
        }).pipe(Effect.provide(layer));

        expect(dataLake.name).toBe(
          `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        );
      }),
    );

    vitest.effect("should create an Iceberg data lake", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();
        const dataLakeId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        const dataLake = yield* WingsClusterMetadata.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "iceberg",
            iceberg: {},
          },
        }).pipe(Effect.provide(layer));

        expect(dataLake.name).toBe(
          `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        );
      }),
    );

    vitest.effect("should get a data lake", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const tenantId = makeId();
        const dataLakeId = makeId();

        yield* WingsClusterMetadata.createTenant({ tenantId }).pipe(
          Effect.provide(layer),
        );

        yield* WingsClusterMetadata.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "parquet",
            parquet: {},
          },
        }).pipe(Effect.provide(layer));

        const dataLake = yield* WingsClusterMetadata.getDataLake({
          name: `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        }).pipe(Effect.provide(layer));

        expect(dataLake.name).toBe(
          `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        );
      }),
    );

    vitest.effect("should list data lakes", () =>
      Effect.gen(function* () {
        if (!wingsContainer) {
          return yield* Effect.fail("Wings container not initialized");
        }

        const layer = WingsClusterMetadata.layer({
          host: wingsContainer.getGrpcHost(),
        });

        const response = yield* WingsClusterMetadata.listDataLakes({
          parent: "tenants/default",
          pageSize: 100,
        }).pipe(Effect.provide(layer));

        expect(response).toHaveProperty("dataLakes");
        expect(Array.isArray(response.dataLakes)).toBe(true);
      }),
    );
  });

  describe("Error Handling", () => {
    vitest.effect("should handle connection errors gracefully", () =>
      Effect.gen(function* () {
        const layer = WingsClusterMetadata.layer({
          host: "localhost:9999", // Non-existent port
        });

        const exit = yield* Effect.exit(
          WingsClusterMetadata.listTenants({ pageSize: 10 }).pipe(
            Effect.provide(layer),
          ),
        );

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause;
          expect(error._tag).toBe("Fail");
        }
      }),
    );

    vitest.effect(
      "should catch ClusterMetadataError with Effect.catchTag",
      () =>
        Effect.gen(function* () {
          if (!wingsContainer) {
            return yield* Effect.fail("Wings container not initialized");
          }

          const layer = WingsClusterMetadata.layer({
            host: wingsContainer.getGrpcHost(),
          });

          const result = yield* WingsClusterMetadata.getTenant({
            name: "tenants/nonexistent",
          }).pipe(
            Effect.provide(layer),
            Effect.catchTag("ClusterMetadataError", (error) =>
              Effect.succeed({ name: "fallback-tenant", error: error.message }),
            ),
          );

          expect(result).toHaveProperty("error");
        }),
    );
  });

  describe("Schema Codecs", () => {
    it("should correctly encode and decode tenant schemas", () => {
      const createRequest: TenantSchemas.CreateTenantRequest = {
        tenantId: "test-tenant",
      };

      const protoRequest =
        TenantSchemas.Codec.CreateTenantRequest.toProto(createRequest);

      expect(protoRequest.tenantId).toBe("test-tenant");
      expect(protoRequest.tenant?.name).toBe("tenants/test-tenant");

      const decodedRequest =
        TenantSchemas.Codec.CreateTenantRequest.fromProto(protoRequest);

      expect(decodedRequest.tenantId).toBe("test-tenant");
    });

    it("should correctly encode and decode topic schemas", () => {
      const createRequest: TopicSchemas.CreateTopicRequest = {
        parent: "tenants/test/namespaces/test",
        topicId: "my-topic",
        fields: [
          { name: "id", dataType: "Int32", nullable: false },
          { name: "name", dataType: "Utf8", nullable: true },
        ],
        compaction: {
          freshnessSeconds: BigInt(3600),
          ttlSeconds: BigInt(86400),
        },
      };

      const protoRequest =
        TopicSchemas.Codec.CreateTopicRequest.toProto(createRequest);

      expect(protoRequest.parent).toBe("tenants/test/namespaces/test");
      expect(protoRequest.topicId).toBe("my-topic");
      expect(protoRequest.topic?.name).toBe(
        "tenants/test/namespaces/test/topics/my-topic",
      );
      expect(protoRequest.topic?.fields.length).toBeGreaterThan(0);

      const decodedRequest =
        TopicSchemas.Codec.CreateTopicRequest.fromProto(protoRequest);

      expect(decodedRequest.topicId).toBe("my-topic");
      expect(decodedRequest.fields.length).toBe(2);
    });
  });
});
