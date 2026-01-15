import { Context, type Effect } from "effect";
import type { CallOptions } from "nice-grpc";
import type { ClusterMetadataError } from "../errors";
import type * as DataLakeSchemas from "../schemas/data-lake";
import type * as NamespaceSchemas from "../schemas/namespace";
import type * as ObjectStoreSchemas from "../schemas/object-store";
import type * as TenantSchemas from "../schemas/tenant";
import type * as TopicSchemas from "../schemas/topic";

/**
 * ClusterMetadata Service Interface
 */
export interface ClusterMetadataService {
  /**
   * Creates a new tenant.
   * @param req - The create tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created tenant
   */
  readonly createTenant: (
    req: TenantSchemas.CreateTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<TenantSchemas.Tenant, ClusterMetadataError>;

  /**
   * Gets a tenant by name.
   * @param req - The get tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the tenant
   */
  readonly getTenant: (
    req: TenantSchemas.GetTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<TenantSchemas.Tenant, ClusterMetadataError>;

  /**
   * Lists tenants with pagination.
   * @param req - The list tenants request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of tenants
   */
  readonly listTenants: (
    req: TenantSchemas.ListTenantsRequest,
    options?: CallOptions,
  ) => Effect.Effect<TenantSchemas.ListTenantsResponse, ClusterMetadataError>;

  /**
   * Deletes a tenant.
   * @param req - The delete tenant request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteTenant: (
    req: TenantSchemas.DeleteTenantRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new namespace.
   * @param req - The create namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created namespace
   */
  readonly createNamespace: (
    req: NamespaceSchemas.CreateNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<NamespaceSchemas.Namespace, ClusterMetadataError>;

  /**
   * Gets a namespace by name.
   * @param req - The get namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the namespace
   */
  readonly getNamespace: (
    req: NamespaceSchemas.GetNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<NamespaceSchemas.Namespace, ClusterMetadataError>;

  /**
   * Lists namespaces with pagination.
   * @param req - The list namespaces request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of namespaces
   */
  readonly listNamespaces: (
    req: NamespaceSchemas.ListNamespacesRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    NamespaceSchemas.ListNamespacesResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes a namespace.
   * @param req - The delete namespace request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteNamespace: (
    req: NamespaceSchemas.DeleteNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new topic.
   * @param req - The create topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created topic
   */
  readonly createTopic: (
    req: TopicSchemas.CreateTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<TopicSchemas.Topic, ClusterMetadataError>;

  /**
   * Gets a topic by name.
   * @param req - The get topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the topic
   */
  readonly getTopic: (
    req: TopicSchemas.GetTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<TopicSchemas.Topic, ClusterMetadataError>;

  /**
   * Lists topics with pagination.
   * @param req - The list topics request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of topics
   */
  readonly listTopics: (
    req: TopicSchemas.ListTopicsRequest,
    options?: CallOptions,
  ) => Effect.Effect<TopicSchemas.ListTopicsResponse, ClusterMetadataError>;

  /**
   * Deletes a topic.
   * @param req - The delete topic request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteTopic: (
    req: TopicSchemas.DeleteTopicRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new object store.
   * @param req - The create object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created object store
   */
  readonly createObjectStore: (
    req: ObjectStoreSchemas.CreateObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<ObjectStoreSchemas.ObjectStore, ClusterMetadataError>;

  /**
   * Gets an object store by name.
   * @param req - The get object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the object store
   */
  readonly getObjectStore: (
    req: ObjectStoreSchemas.GetObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<ObjectStoreSchemas.ObjectStore, ClusterMetadataError>;

  /**
   * Lists object stores with pagination.
   * @param req - The list object stores request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of object stores
   */
  readonly listObjectStores: (
    req: ObjectStoreSchemas.ListObjectStoresRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    ObjectStoreSchemas.ListObjectStoresResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes an object store.
   * @param req - The delete object store request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteObjectStore: (
    req: ObjectStoreSchemas.DeleteObjectStoreRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterMetadataError>;

  /**
   * Creates a new data lake.
   * @param req - The create data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the created data lake
   */
  readonly createDataLake: (
    req: DataLakeSchemas.CreateDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<DataLakeSchemas.DataLake, ClusterMetadataError>;

  /**
   * Gets a data lake by name.
   * @param req - The get data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the data lake
   */
  readonly getDataLake: (
    req: DataLakeSchemas.GetDataLakeRequest,
    options?: CallOptions,
  ) => Effect.Effect<DataLakeSchemas.DataLake, ClusterMetadataError>;

  /**
   * Lists data lakes with pagination.
   * @param req - The list data lakes request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves to the list of data lakes
   */
  readonly listDataLakes: (
    req: DataLakeSchemas.ListDataLakesRequest,
    options?: CallOptions,
  ) => Effect.Effect<
    DataLakeSchemas.ListDataLakesResponse,
    ClusterMetadataError
  >;

  /**
   * Deletes a data lake.
   * @param req - The delete data lake request
   * @param options - Optional gRPC call options
   * @returns Effect that resolves when deletion is complete
   */
  readonly deleteDataLake: (
    req: DataLakeSchemas.DeleteDataLakeRequest,
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
