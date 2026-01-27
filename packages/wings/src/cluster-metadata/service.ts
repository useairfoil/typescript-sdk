import { Context, type Effect } from "effect";
import type { CallOptions } from "nice-grpc";
import type { ClusterMetadataError } from "../errors";
import type { ClusterMetadataServiceClient } from "../proto/cluster_metadata";
import type * as WS from "../schema";

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
    req: WS.Tenant.CreateTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Tenant.Tenant, ClusterMetadataError>;

  /**
   * Gets a tenant by name.
   * @param req - The get tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the tenant
   */
  readonly getTenant: (
    req: WS.Tenant.GetTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Tenant.Tenant, ClusterMetadataError>;

  /**
   * Lists tenants with pagination.
   * @param req - The list tenants request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of tenants
   */
  readonly listTenants: (
    req: WS.Tenant.ListTenantsRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Tenant.ListTenantsResponse, ClusterMetadataError>;

  /**
   * Deletes a tenant.
   * @param req - The delete tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteTenant: (
    req: WS.Tenant.DeleteTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new namespace.
   * @param req - The create namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created namespace
   */
  readonly createNamespace: (
    req: WS.Namespace.CreateNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Namespace.Namespace, ClusterMetadataError>;

  /**
   * Gets a namespace by name.
   * @param req - The get namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the namespace
   */
  readonly getNamespace: (
    req: WS.Namespace.GetNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Namespace.Namespace, ClusterMetadataError>;

  /**
   * Lists namespaces with pagination.
   * @param req - The list namespaces request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of namespaces
   */
  readonly listNamespaces: (
    req: WS.Namespace.ListNamespacesRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Namespace.ListNamespacesResponse, ClusterMetadataError>;

  /**
   * Deletes a namespace.
   * @param req - The delete namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteNamespace: (
    req: WS.Namespace.DeleteNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new topic.
   * @param req - The create topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created topic
   */
  readonly createTopic: (
    req: WS.Topic.CreateTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Topic.Topic, ClusterMetadataError>;

  /**
   * Gets a topic by name.
   * @param req - The get topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the topic
   */
  readonly getTopic: (
    req: WS.Topic.GetTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Topic.Topic, ClusterMetadataError>;

  /**
   * Lists topics with pagination.
   * @param req - The list topics request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of topics
   */
  readonly listTopics: (
    req: WS.Topic.ListTopicsRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.Topic.ListTopicsResponse, ClusterMetadataError>;

  /**
   * Deletes a topic.
   * @param req - The delete topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteTopic: (
    req: WS.Topic.DeleteTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new object store.
   * @param req - The create object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created object store
   */
  readonly createObjectStore: (
    req: WS.ObjectStore.CreateObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.ObjectStore.ObjectStore, ClusterMetadataError>;

  /**
   * Gets an object store by name.
   * @param req - The get object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the object store
   */
  readonly getObjectStore: (
    req: WS.ObjectStore.GetObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.ObjectStore.ObjectStore, ClusterMetadataError>;

  /**
   * Lists object stores with pagination.
   * @param req - The list object stores request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of object stores
   */
  readonly listObjectStores: (
    req: WS.ObjectStore.ListObjectStoresRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    WS.ObjectStore.ListObjectStoresResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes an object store.
   * @param req - The delete object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteObjectStore: (
    req: WS.ObjectStore.DeleteObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new data lake.
   * @param req - The create data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created data lake
   */
  readonly createDataLake: (
    req: WS.DataLake.CreateDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.DataLake.DataLake, ClusterMetadataError>;

  /**
   * Gets a data lake by name.
   * @param req - The get data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the data lake
   */
  readonly getDataLake: (
    req: WS.DataLake.GetDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.DataLake.DataLake, ClusterMetadataError>;

  /**
   * Lists data lakes with pagination.
   * @param req - The list data lakes request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of data lakes
   */
  readonly listDataLakes: (
    req: WS.DataLake.ListDataLakesRequest,
    options?: CallOptions,
  ) => Effect.Effect<WS.DataLake.ListDataLakesResponse, ClusterMetadataError>;

  /**
   * Deletes a data lake.
   * @param req - The delete data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteDataLake: (
    req: WS.DataLake.DeleteDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;
}

/**
 * ClusterMetadata Service Tag
 *
 * Used to provide and access the ClusterMetadata service in the Effect context.
 */
export class ClusterMetadata extends Context.Tag(
  "@airfoil/wings/ClusterMetadata",
)<ClusterMetadata, ClusterMetadataService>() {}
