import type { Effect } from "effect";
import * as ServiceMap from "effect/ServiceMap";
import type { CallOptions } from "nice-grpc";
import type * as ClusterSchema from "../cluster";
import type { ClusterMetadataError } from "../errors";
import type { ClusterMetadataServiceClient } from "../proto/wings/v1/cluster_metadata";

/**
 * ClusterMetadata Service Interface
 */
export interface ClusterMetadataService {
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
   *   const service = yield* ClusterMetadata;
   *   const protobufClient = service.getProtobufClient();
   *
   *   // Use protobuf client to get protobuf Topic type
   *   const topic = yield* Effect.tryPromise({
   *     try: () => protobufClient.getTopic({ name: "..." }),
   *     catch: (e) => new ClusterMetadataError({ message: String(e), cause: e })
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
  ) => Effect.Effect<ClusterSchema.Tenant.Tenant, ClusterMetadataError>;

  /**
   * Gets a tenant by name.
   * @param req - The get tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the tenant
   */
  readonly getTenant: (
    req: ClusterSchema.Tenant.GetTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Tenant.Tenant, ClusterMetadataError>;

  /**
   * Lists tenants with pagination.
   * @param req - The list tenants request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of tenants
   */
  readonly listTenants: (
    req: ClusterSchema.Tenant.ListTenantsRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    ClusterSchema.Tenant.ListTenantsResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes a tenant.
   * @param req - The delete tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteTenant: (
    req: ClusterSchema.Tenant.DeleteTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new namespace.
   * @param req - The create namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created namespace
   */
  readonly createNamespace: (
    req: ClusterSchema.Namespace.CreateNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.Namespace, ClusterMetadataError>;

  /**
   * Gets a namespace by name.
   * @param req - The get namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the namespace
   */
  readonly getNamespace: (
    req: ClusterSchema.Namespace.GetNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.Namespace, ClusterMetadataError>;

  /**
   * Lists namespaces with pagination.
   * @param req - The list namespaces request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of namespaces
   */
  readonly listNamespaces: (
    req: ClusterSchema.Namespace.ListNamespacesRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    ClusterSchema.Namespace.ListNamespacesResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes a namespace.
   * @param req - The delete namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteNamespace: (
    req: ClusterSchema.Namespace.DeleteNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new topic.
   * @param req - The create topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created topic
   */
  readonly createTopic: (
    req: ClusterSchema.Topic.CreateTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Topic.Topic, ClusterMetadataError>;

  /**
   * Gets a topic by name.
   * @param req - The get topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the topic
   */
  readonly getTopic: (
    req: ClusterSchema.Topic.GetTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Topic.Topic, ClusterMetadataError>;

  /**
   * Lists topics with pagination.
   * @param req - The list topics request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of topics
   */
  readonly listTopics: (
    req: ClusterSchema.Topic.ListTopicsRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    ClusterSchema.Topic.ListTopicsResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes a topic.
   * @param req - The delete topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteTopic: (
    req: ClusterSchema.Topic.DeleteTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new object store.
   * @param req - The create object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created object store
   */
  readonly createObjectStore: (
    req: ClusterSchema.ObjectStore.CreateObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    ClusterSchema.ObjectStore.ObjectStore,
    ClusterMetadataError
  >;

  /**
   * Gets an object store by name.
   * @param req - The get object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the object store
   */
  readonly getObjectStore: (
    req: ClusterSchema.ObjectStore.GetObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    ClusterSchema.ObjectStore.ObjectStore,
    ClusterMetadataError
  >;

  /**
   * Lists object stores with pagination.
   * @param req - The list object stores request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of object stores
   */
  readonly listObjectStores: (
    req: ClusterSchema.ObjectStore.ListObjectStoresRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    ClusterSchema.ObjectStore.ListObjectStoresResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes an object store.
   * @param req - The delete object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteObjectStore: (
    req: ClusterSchema.ObjectStore.DeleteObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new data lake.
   * @param req - The create data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created data lake
   */
  readonly createDataLake: (
    req: ClusterSchema.DataLake.CreateDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.DataLake.DataLake, ClusterMetadataError>;

  /**
   * Gets a data lake by name.
   * @param req - The get data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the data lake
   */
  readonly getDataLake: (
    req: ClusterSchema.DataLake.GetDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.DataLake.DataLake, ClusterMetadataError>;

  /**
   * Lists data lakes with pagination.
   * @param req - The list data lakes request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of data lakes
   */
  readonly listDataLakes: (
    req: ClusterSchema.DataLake.ListDataLakesRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    ClusterSchema.DataLake.ListDataLakesResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes a data lake.
   * @param req - The delete data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteDataLake: (
    req: ClusterSchema.DataLake.DeleteDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;
}

/**
 * ClusterMetadata Service Tag
 *
 * Used to provide and access the ClusterMetadata service in the Effect context.
 */
export class ClusterMetadata extends ServiceMap.Service<
  ClusterMetadata,
  ClusterMetadataService
>()("@useairfoil/wings/ClusterMetadata") {}
