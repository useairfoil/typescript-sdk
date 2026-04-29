import type { CallOptions } from "nice-grpc";

import { Context, type Effect } from "effect";

import type * as ClusterSchema from "../cluster";
import type { ClusterClientError } from "../errors";
import type { ClusterMetadataServiceClient } from "../proto/wings/v1/cluster_metadata";

/**
 * ClusterClient Service Interface
 */
export interface ClusterClientService {
  /**
   * Returns the underlying gRPC client that works with protobuf types.
   *
   * Use this for advanced use cases when you need direct access to the protobuf
   * client instead of the Effect Schema-based API. This is useful when:
   * - You need protobuf types directly
   * - You're integrating with non-Effect code
   * - You need access to advanced gRPC features
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const service = yield* ClusterClient;
   *   const protobufClient = service.getProtobufClient();
   *
   *   // Use protobuf client to get protobuf Topic type
   *   const topic = yield* Effect.tryPromise({
   *     try: () => protobufClient.getTopic({ name: "..." }),
   *     catch: (e) => new ClusterClientError({ message: String(e), cause: e })
   *   });
   * });
   * ```
   */
  readonly getProtobufClient: () => ClusterMetadataServiceClient;
  /**
   * Creates a new tenant.
   * @param req - The create tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created tenant
   */
  readonly createTenant: (
    req: ClusterSchema.Tenant.CreateTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Tenant.Tenant, ClusterClientError>;

  /**
   * Gets a tenant by name.
   * @param req - The get tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the tenant
   */
  readonly getTenant: (
    req: ClusterSchema.Tenant.GetTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Tenant.Tenant, ClusterClientError>;

  /**
   * Lists tenants with pagination.
   * @param req - The list tenants request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of tenants
   */
  readonly listTenants: (
    req: ClusterSchema.Tenant.ListTenantsRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Tenant.ListTenantsResponse, ClusterClientError>;

  /**
   * Deletes a tenant.
   * @param req - The delete tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteTenant: (
    req: ClusterSchema.Tenant.DeleteTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterClientError>;

  /**
   * Creates a new namespace.
   * @param req - The create namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created namespace
   */
  readonly createNamespace: (
    req: ClusterSchema.Namespace.CreateNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.Namespace, ClusterClientError>;

  /**
   * Gets a namespace by name.
   * @param req - The get namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the namespace
   */
  readonly getNamespace: (
    req: ClusterSchema.Namespace.GetNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.Namespace, ClusterClientError>;

  /**
   * Lists namespaces with pagination.
   * @param req - The list namespaces request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of namespaces
   */
  readonly listNamespaces: (
    req: ClusterSchema.Namespace.ListNamespacesRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.ListNamespacesResponse, ClusterClientError>;

  /**
   * Deletes a namespace.
   * @param req - The delete namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteNamespace: (
    req: ClusterSchema.Namespace.DeleteNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterClientError>;

  /**
   * Creates a new topic.
   * @param req - The create topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created topic
   */
  readonly createTopic: (
    req: ClusterSchema.Topic.CreateTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Topic.Topic, ClusterClientError>;

  /**
   * Gets a topic by name.
   * @param req - The get topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the topic
   */
  readonly getTopic: (
    req: ClusterSchema.Topic.GetTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Topic.Topic, ClusterClientError>;

  /**
   * Lists topics with pagination.
   * @param req - The list topics request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of topics
   */
  readonly listTopics: (
    req: ClusterSchema.Topic.ListTopicsRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Topic.ListTopicsResponse, ClusterClientError>;

  /**
   * Deletes a topic.
   * @param req - The delete topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteTopic: (
    req: ClusterSchema.Topic.DeleteTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterClientError>;

  /**
   * Creates a new object store.
   * @param req - The create object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created object store
   */
  readonly createObjectStore: (
    req: ClusterSchema.ObjectStore.CreateObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.ObjectStore.ObjectStore, ClusterClientError>;

  /**
   * Gets an object store by name.
   * @param req - The get object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the object store
   */
  readonly getObjectStore: (
    req: ClusterSchema.ObjectStore.GetObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.ObjectStore.ObjectStore, ClusterClientError>;

  /**
   * Lists object stores with pagination.
   * @param req - The list object stores request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of object stores
   */
  readonly listObjectStores: (
    req: ClusterSchema.ObjectStore.ListObjectStoresRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.ObjectStore.ListObjectStoresResponse, ClusterClientError>;

  /**
   * Deletes an object store.
   * @param req - The delete object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteObjectStore: (
    req: ClusterSchema.ObjectStore.DeleteObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterClientError>;

  /**
   * Creates a new data lake.
   * @param req - The create data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created data lake
   */
  readonly createDataLake: (
    req: ClusterSchema.DataLake.CreateDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.DataLake.DataLake, ClusterClientError>;

  /**
   * Gets a data lake by name.
   * @param req - The get data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the data lake
   */
  readonly getDataLake: (
    req: ClusterSchema.DataLake.GetDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.DataLake.DataLake, ClusterClientError>;

  /**
   * Lists data lakes with pagination.
   * @param req - The list data lakes request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of data lakes
   */
  readonly listDataLakes: (
    req: ClusterSchema.DataLake.ListDataLakesRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.DataLake.ListDataLakesResponse, ClusterClientError>;

  /**
   * Deletes a data lake.
   * @param req - The delete data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteDataLake: (
    req: ClusterSchema.DataLake.DeleteDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterClientError>;
}

/**
 * ClusterClient Service Tag
 *
 * Used to provide and access the ClusterClient service in the Effect context.
 */
export class ClusterClient extends Context.Service<ClusterClient, ClusterClientService>()(
  "@useairfoil/wings/ClusterClient",
) {}
