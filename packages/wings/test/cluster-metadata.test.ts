import { describe, expect, layer } from "@effect/vitest";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect, Exit, Layer } from "effect";
import { customAlphabet } from "nanoid";

import { ClusterClient } from "../src";
import * as ClusterSchema from "../src/cluster";

const makeId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 12);

const wingsLayer = Layer.effect(ClusterClient.ClusterClient)(
  Effect.gen(function* () {
    const w = yield* TestWings.Instance;
    const host = yield* w.grpcHostAndPort;
    return yield* ClusterClient.make({
      host,
    });
  }),
);

// One container is shared across all tests
const testLayer = wingsLayer.pipe(Layer.provide(TestWings.container));

layer(testLayer, { timeout: "60 seconds" })("ClusterMetadata", (it) => {
  describe("Layer Configuration", () => {
    it.effect("should create layer with direct config", () =>
      Effect.gen(function* () {
        const result = yield* ClusterClient.listTenants({
          pageSize: 10,
        });

        expect(result).toHaveProperty("tenants");
        expect(Array.isArray(result.tenants)).toBe(true);
      }),
    );
  });

  describe("Tenant Operations", () => {
    it.effect("should create a tenant", () =>
      Effect.gen(function* () {
        const tenantId = makeId();

        const tenant = yield* ClusterClient.createTenant({
          tenantId,
        });

        expect(tenant.name).toBe(`tenants/${tenantId}`);
      }),
    );

    it.effect("should get a tenant", () =>
      Effect.gen(function* () {
        const tenantId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        const tenant = yield* ClusterClient.getTenant({
          name: `tenants/${tenantId}`,
        });

        expect(tenant.name).toBe(`tenants/${tenantId}`);
      }),
    );

    it.effect("should list tenants", () =>
      Effect.gen(function* () {
        const response = yield* ClusterClient.listTenants({
          pageSize: 100,
        });

        expect(response).toHaveProperty("tenants");
        expect(Array.isArray(response.tenants)).toBe(true);
      }),
    );

    it.effect("should delete a tenant", () =>
      Effect.gen(function* () {
        const tenantId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        yield* ClusterClient.deleteTenant({
          name: `tenants/${tenantId}`,
        });

        const exit = yield* Effect.exit(
          ClusterClient.getTenant({
            name: `tenants/${tenantId}`,
          }),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }),
    );

    it.effect("should handle tenant not found error", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          ClusterClient.getTenant({
            name: "tenants/nonexistent",
          }),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }),
    );
  });

  describe("Namespace Operations", () => {
    it.effect("should create a namespace", () =>
      Effect.gen(function* () {
        const tenantId = makeId();
        const namespaceId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        const objectStoreId = makeId();

        yield* ClusterClient.createObjectStore({
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
        });

        const dataLakeId = makeId();
        yield* ClusterClient.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "parquet",
            parquet: {},
          },
        });

        const namespace = yield* ClusterClient.createNamespace({
          parent: `tenants/${tenantId}`,
          namespaceId,
          flushSizeBytes: BigInt(1024 * 1024),
          flushIntervalMillis: BigInt(5000),
          objectStore: `tenants/${tenantId}/object-stores/${objectStoreId}`,
          dataLake: `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        });

        expect(namespace.name).toBe(`tenants/${tenantId}/namespaces/${namespaceId}`);
      }),
    );

    it.effect("should get a namespace", () =>
      Effect.gen(function* () {
        const tenantId = makeId();
        const namespaceId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        const objectStoreId = makeId();
        yield* ClusterClient.createObjectStore({
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
        });

        const dataLakeId = makeId();
        yield* ClusterClient.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "parquet",
            parquet: {},
          },
        });

        yield* ClusterClient.createNamespace({
          parent: `tenants/${tenantId}`,
          namespaceId,
          flushSizeBytes: BigInt(1024 * 1024),
          flushIntervalMillis: BigInt(5000),
          objectStore: `tenants/${tenantId}/object-stores/${objectStoreId}`,
          dataLake: `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        });

        const namespace = yield* ClusterClient.getNamespace({
          name: `tenants/${tenantId}/namespaces/${namespaceId}`,
        });

        expect(namespace.name).toBe(`tenants/${tenantId}/namespaces/${namespaceId}`);
      }),
    );

    it.effect("should list namespaces", () =>
      Effect.gen(function* () {
        const response = yield* ClusterClient.listNamespaces({
          parent: "tenants/default",
          pageSize: 100,
        });

        expect(response).toHaveProperty("namespaces");
        expect(Array.isArray(response.namespaces)).toBe(true);
      }),
    );
  });

  describe("Topic Operations", () => {
    it.effect("should create a topic", () =>
      Effect.gen(function* () {
        const topicId = makeId();

        const topic = yield* ClusterClient.createTopic({
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
        });

        expect(topic.name).toBe(`tenants/default/namespaces/default/topics/${topicId}`);
      }),
    );

    it.effect("should get a topic", () =>
      Effect.gen(function* () {
        const topicId = makeId();

        yield* ClusterClient.createTopic({
          parent: "tenants/default/namespaces/default",
          topicId,
          fields: [{ name: "field1", dataType: "Int32", nullable: false, id: 1n }],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
            targetFileSizeBytes: BigInt(1024 * 1024),
          },
        });

        const topic = yield* ClusterClient.getTopic({
          name: `tenants/default/namespaces/default/topics/${topicId}`,
        });

        expect(topic.name).toBe(`tenants/default/namespaces/default/topics/${topicId}`);
        expect(topic.schema.fields.length).toBeGreaterThan(0);
      }),
    );

    it.effect("should list topics", () =>
      Effect.gen(function* () {
        const response = yield* ClusterClient.listTopics({
          parent: "tenants/default/namespaces/default",
          pageSize: 100,
        });

        expect(response).toHaveProperty("topics");
        expect(Array.isArray(response.topics)).toBe(true);
      }),
    );

    it.effect("should delete a topic", () =>
      Effect.gen(function* () {
        const topicId = makeId();

        yield* ClusterClient.createTopic({
          parent: "tenants/default/namespaces/default",
          topicId,
          fields: [{ name: "field1", dataType: "Int32", nullable: false, id: 1n }],
          compaction: {
            freshnessSeconds: BigInt(3600),
            ttlSeconds: BigInt(86400),
            targetFileSizeBytes: BigInt(1024 * 1024),
          },
        });

        yield* ClusterClient.deleteTopic({
          name: `tenants/default/namespaces/default/topics/${topicId}`,
          force: true,
        });

        const exit = yield* Effect.exit(
          ClusterClient.getTopic({
            name: `tenants/default/namespaces/default/topics/${topicId}`,
          }),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }),
    );
  });

  describe("Object Store Operations", () => {
    it.effect("should create an S3 object store", () =>
      Effect.gen(function* () {
        const tenantId = makeId();
        const objectStoreId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        const objectStore = yield* ClusterClient.createObjectStore({
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
        });

        expect(objectStore.name).toBe(`tenants/${tenantId}/object-stores/${objectStoreId}`);
      }),
    );

    it.effect("should get an object store", () =>
      Effect.gen(function* () {
        const tenantId = makeId();
        const objectStoreId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        yield* ClusterClient.createObjectStore({
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
        });

        const objectStore = yield* ClusterClient.getObjectStore({
          name: `tenants/${tenantId}/object-stores/${objectStoreId}`,
        });

        expect(objectStore.name).toBe(`tenants/${tenantId}/object-stores/${objectStoreId}`);
      }),
    );

    it.effect("should list object stores", () =>
      Effect.gen(function* () {
        const response = yield* ClusterClient.listObjectStores({
          parent: "tenants/default",
          pageSize: 100,
        });

        expect(response).toHaveProperty("objectStores");
        expect(Array.isArray(response.objectStores)).toBe(true);
      }),
    );
  });

  describe("Data Lake Operations", () => {
    it.effect("should create a Parquet data lake", () =>
      Effect.gen(function* () {
        const tenantId = makeId();
        const dataLakeId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        const dataLake = yield* ClusterClient.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "parquet",
            parquet: {},
          },
        });

        expect(dataLake.name).toBe(`tenants/${tenantId}/data-lakes/${dataLakeId}`);
      }),
    );

    it.effect("should create an Iceberg data lake", () =>
      Effect.gen(function* () {
        const tenantId = makeId();
        const dataLakeId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        const dataLake = yield* ClusterClient.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "iceberg",
            iceberg: {},
          },
        });

        expect(dataLake.name).toBe(`tenants/${tenantId}/data-lakes/${dataLakeId}`);
      }),
    );

    it.effect("should get a data lake", () =>
      Effect.gen(function* () {
        const tenantId = makeId();
        const dataLakeId = makeId();

        yield* ClusterClient.createTenant({ tenantId });

        yield* ClusterClient.createDataLake({
          parent: `tenants/${tenantId}`,
          dataLakeId,
          dataLakeConfig: {
            _tag: "parquet",
            parquet: {},
          },
        });

        const dataLake = yield* ClusterClient.getDataLake({
          name: `tenants/${tenantId}/data-lakes/${dataLakeId}`,
        });

        expect(dataLake.name).toBe(`tenants/${tenantId}/data-lakes/${dataLakeId}`);
      }),
    );

    it.effect("should list data lakes", () =>
      Effect.gen(function* () {
        const response = yield* ClusterClient.listDataLakes({
          parent: "tenants/default",
          pageSize: 100,
        });

        expect(response).toHaveProperty("dataLakes");
        expect(Array.isArray(response.dataLakes)).toBe(true);
      }),
    );
  });

  describe("Error Handling", () => {
    it.effect("should handle connection errors gracefully", () => {
      const errorLayer = ClusterClient.layer({
        host: "localhost:9999", // Non-existent port
      });
      return Effect.gen(function* () {
        const exit = yield* Effect.exit(
          ClusterClient.listTenants({
            pageSize: 10,
          }),
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }).pipe(Effect.provide(errorLayer));
    });

    it.effect("should catch ClusterClientError with Effect.catchTag", () =>
      Effect.gen(function* () {
        const result = yield* ClusterClient.getTenant({
          name: "tenants/nonexistent",
        }).pipe(
          Effect.catchTag("ClusterClientError", (error) =>
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

        const protoRequest = ClusterSchema.Tenant.Codec.CreateTenantRequest.toProto(createRequest);

        expect(protoRequest.tenantId).toBe("test-tenant");
        expect(protoRequest.tenant?.name).toBe("tenants/test-tenant");

        const decodedRequest =
          ClusterSchema.Tenant.Codec.CreateTenantRequest.fromProto(protoRequest);

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

        const protoRequest = ClusterSchema.Topic.Codec.CreateTopicRequest.toProto(createRequest);

        expect(protoRequest.parent).toBe("tenants/test/namespaces/test");
        expect(protoRequest.topicId).toBe("my-topic");
        expect(protoRequest.topic?.name).toBe("tenants/test/namespaces/test/topics/my-topic");
        expect(protoRequest.topic?.schema?.fields.length).toBeGreaterThan(0);

        const decodedRequest = ClusterSchema.Topic.Codec.CreateTopicRequest.fromProto(protoRequest);

        expect(decodedRequest.topicId).toBe("my-topic");
        expect(decodedRequest.fields.length).toBe(2);
      }),
    );
  });
});
