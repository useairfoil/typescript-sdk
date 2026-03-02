import { describe, expect, it } from "@effect/vitest";
import { WingsContainer } from "@useairfoil/flight/test";
import { Effect, Exit } from "effect";
import { customAlphabet } from "nanoid";
import { afterAll, beforeAll } from "vitest";
import { WingsClusterMetadata } from "../src";
import * as ClusterSchema from "../src/cluster";

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
    it.effect("should create layer with direct config", () =>
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
    it.effect("should create a tenant", () =>
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

    it.effect("should get a tenant", () =>
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

    it.effect("should list tenants", () =>
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

    it.effect("should delete a tenant", () =>
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

    it.effect("should handle tenant not found error", () =>
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
    it.effect("should create a namespace", () =>
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
              allowHttp: false,
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

    it.effect("should get a namespace", () =>
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
              allowHttp: false,
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

    it.effect("should list namespaces", () =>
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
    it.effect("should create a topic", () =>
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
            { name: "id", dataType: "Int32", nullable: false, id: 1n },
            { name: "name", dataType: "Utf8", nullable: true, id: 2n },
          ],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
            targetFileSizeBytes: BigInt(1024 * 1024),
          },
        }).pipe(Effect.provide(layer));

        expect(topic.name).toBe(
          `tenants/default/namespaces/default/topics/${topicId}`,
        );
      }),
    );

    it.effect("should get a topic", () =>
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
          fields: [
            { name: "field1", dataType: "Int32", nullable: false, id: 1n },
          ],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
            targetFileSizeBytes: BigInt(1024 * 1024),
          },
        }).pipe(Effect.provide(layer));

        const topic = yield* WingsClusterMetadata.getTopic({
          name: `tenants/default/namespaces/default/topics/${topicId}`,
        }).pipe(Effect.provide(layer));

        expect(topic.name).toBe(
          `tenants/default/namespaces/default/topics/${topicId}`,
        );
        expect(topic.schema.fields.length).toBeGreaterThan(0);
      }),
    );

    it.effect("should list topics", () =>
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

    it.effect("should delete a topic", () =>
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
          fields: [
            { name: "field1", dataType: "Int32", nullable: false, id: 1n },
          ],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
            targetFileSizeBytes: BigInt(1024 * 1024),
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
    it.effect("should create an S3 object store", () =>
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
              allowHttp: false,
            },
          },
        }).pipe(Effect.provide(layer));

        expect(objectStore.name).toBe(
          `tenants/${tenantId}/object-stores/${objectStoreId}`,
        );
      }),
    );

    it.effect("should get an object store", () =>
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
              allowHttp: false,
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

    it.effect("should list object stores", () =>
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
    it.effect("should create a Parquet data lake", () =>
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

    it.effect("should create an Iceberg data lake", () =>
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

    it.effect("should get a data lake", () =>
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

    it.effect("should list data lakes", () =>
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
    it.effect("should handle connection errors gracefully", () =>
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

    it.effect("should catch ClusterMetadataError with Effect.catchTag", () =>
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
    it.effect("should correctly encode and decode tenant schemas", () =>
      Effect.sync(() => {
        const createRequest: ClusterSchema.Tenant.CreateTenantRequest = {
          tenantId: "test-tenant",
        };

        const protoRequest =
          ClusterSchema.Tenant.Codec.CreateTenantRequest.toProto(createRequest);

        expect(protoRequest.tenantId).toBe("test-tenant");
        expect(protoRequest.tenant?.name).toBe("tenants/test-tenant");

        const decodedRequest =
          ClusterSchema.Tenant.Codec.CreateTenantRequest.fromProto(
            protoRequest,
          );

        expect(decodedRequest.tenantId).toBe("test-tenant");
      }),
    );

    it.effect("should correctly encode and decode topic schemas", () =>
      Effect.sync(() => {
        const createRequest: ClusterSchema.Topic.CreateTopicRequest = {
          parent: "tenants/test/namespaces/test",
          topicId: "my-topic",
          fields: [
            { name: "id", dataType: "Int32", nullable: false, id: 1n },
            { name: "name", dataType: "Utf8", nullable: true, id: 2n },
          ],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
            targetFileSizeBytes: BigInt(1024 * 1024),
          },
        };

        const protoRequest =
          ClusterSchema.Topic.Codec.CreateTopicRequest.toProto(createRequest);

        expect(protoRequest.parent).toBe("tenants/test/namespaces/test");
        expect(protoRequest.topicId).toBe("my-topic");
        expect(protoRequest.topic?.name).toBe(
          "tenants/test/namespaces/test/topics/my-topic",
        );
        expect(protoRequest.topic?.schema?.fields.length).toBeGreaterThan(0);

        const decodedRequest =
          ClusterSchema.Topic.Codec.CreateTopicRequest.fromProto(protoRequest);

        expect(decodedRequest.topicId).toBe("my-topic");
        expect(decodedRequest.fields.length).toBe(2);
      }),
    );
  });
});
