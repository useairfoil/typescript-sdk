import {
  type ClientOptions,
  createChannelFromConfig,
  type HostOrChannel,
} from "@airfoil/flight";
import { type CallOptions, type Channel, createClient } from "nice-grpc";
import {
  type ClusterMetadataServiceClient,
  ClusterMetadataServiceDefinition,
} from "../proto/cluster_metadata";
import {
  CreateDataLakeRequest,
  DataLake,
  DeleteDataLakeRequest,
  GetDataLakeRequest,
  ListDataLakesRequest,
  ListDataLakesResponse,
} from "./data-lake";
import {
  CreateNamespaceRequest,
  DeleteNamespaceRequest,
  GetNamespaceRequest,
  ListNamespacesRequest,
  ListNamespacesResponse,
  Namespace,
} from "./namespace";
import {
  CreateObjectStoreRequest,
  DeleteObjectStoreRequest,
  GetObjectStoreRequest,
  ListObjectStoresRequest,
  ListObjectStoresResponse,
  ObjectStore,
} from "./object-store";
import {
  CreateTenantRequest,
  DeleteTenantRequest,
  GetTenantRequest,
  ListTenantsRequest,
  ListTenantsResponse,
  Tenant,
} from "./tenant";
import {
  CreateTopicRequest,
  DeleteTopicRequest,
  GetTopicRequest,
  ListTopicsRequest,
  ListTopicsResponse,
  Topic,
} from "./topic";

/**
 * Client for interacting with the cluster metadata service.
 * Provides methods for managing tenants, namespaces, topics, object stores, and data lakes.
 */
export class ClusterMetadataClient {
  private channel: Channel;
  private inner: ClusterMetadataServiceClient;

  constructor(
    config: HostOrChannel,
    options?: ClientOptions<ClusterMetadataServiceDefinition>,
  ) {
    this.channel = createChannelFromConfig(config);
    this.inner = createClient(
      ClusterMetadataServiceDefinition,
      this.channel,
      options?.defaultCallOptions,
    );
  }

  /**
   * Returns the raw gRPC client for the cluster metadata service.
   * Use this for advanced use cases or when you need direct access to the underlying client.
   */
  rawClient() {
    return this.inner;
  }

  // ------- TENANT --------

  /**
   * Creates a new tenant.
   * @param req - The create tenant request containing the tenant id and metadata.
   * @param options - Optional gRPC call options.
   * @returns The created tenant.
   */
  async createTenant(
    req: CreateTenantRequest,
    options?: CallOptions,
  ): Promise<Tenant> {
    const response = await this.inner.createTenant(
      CreateTenantRequest.encode(req),
      options,
    );
    return Tenant.decode(response);
  }

  /**
   * Gets a tenant by name.
   * @param req - The get tenant request containing the tenant name (format: `tenants/{tenant}`).
   * @param options - Optional gRPC call options.
   * @returns The requested tenant.
   */
  async getTenant(
    req: GetTenantRequest,
    options?: CallOptions,
  ): Promise<Tenant> {
    const response = await this.inner.getTenant(
      GetTenantRequest.encode(req),
      options,
    );
    return Tenant.decode(response);
  }

  /**
   * Lists all tenants with pagination support.
   * @param req - The list tenants request with optional pageSize (default: 100, max: 1000) and pageToken.
   * @param options - Optional gRPC call options.
   * @returns A paginated list of tenants.
   */
  async listTenants(
    req: ListTenantsRequest,
    options?: CallOptions,
  ): Promise<ListTenantsResponse> {
    const response = await this.inner.listTenants(
      ListTenantsRequest.encode(req),
      options,
    );
    return ListTenantsResponse.decode(response);
  }

  /**
   * Deletes a tenant.
   * @param req - The delete tenant request containing the tenant name (format: `tenants/{tenant}`).
   * @param options - Optional gRPC call options.
   */
  async deleteTenant(
    req: DeleteTenantRequest,
    options?: CallOptions,
  ): Promise<void> {
    await this.inner.deleteTenant(DeleteTenantRequest.encode(req), options);
  }

  // ------- OBJECT STORE --------

  /**
   * Creates a new object store within a tenant.
   * @param req - The create object store request containing the parent tenant, object store id, and configuration.
   * @param options - Optional gRPC call options.
   * @returns The created object store.
   */
  async createObjectStore(
    req: CreateObjectStoreRequest,
    options?: CallOptions,
  ): Promise<ObjectStore> {
    const response = await this.inner.createObjectStore(
      CreateObjectStoreRequest.encode(req),
      options,
    );
    return ObjectStore.decode(response);
  }

  /**
   * Gets an object store by name.
   * @param req - The get object store request containing the name (format: `tenants/{tenant}/object-stores/{object-store}`).
   * @param options - Optional gRPC call options.
   * @returns The requested object store.
   */
  async getObjectStore(
    req: GetObjectStoreRequest,
    options?: CallOptions,
  ): Promise<ObjectStore> {
    const response = await this.inner.getObjectStore(
      GetObjectStoreRequest.encode(req),
      options,
    );
    return ObjectStore.decode(response);
  }

  /**
   * Lists all object stores within a tenant with pagination support.
   * @param req - The list object stores request with parent tenant, optional pageSize (default: 100, max: 1000), and pageToken.
   * @param options - Optional gRPC call options.
   * @returns A paginated list of object stores.
   */
  async listObjectStores(
    req: ListObjectStoresRequest,
    options?: CallOptions,
  ): Promise<ListObjectStoresResponse> {
    const response = await this.inner.listObjectStores(
      ListObjectStoresRequest.encode(req),
      options,
    );
    return ListObjectStoresResponse.decode(response);
  }

  /**
   * Deletes an object store.
   * @param req - The delete object store request containing the name (format: `tenants/{tenant}/object-stores/{object-store}`).
   * @param options - Optional gRPC call options.
   */
  async deleteObjectStore(
    req: DeleteObjectStoreRequest,
    options?: CallOptions,
  ): Promise<void> {
    await this.inner.deleteObjectStore(
      DeleteObjectStoreRequest.encode(req),
      options,
    );
  }

  // ------- DATA LAKE --------

  /**
   * Creates a new data lake within a tenant.
   * @param req - The create data lake request containing the parent tenant, data lake id, and configuration.
   * @param options - Optional gRPC call options.
   * @returns The created data lake.
   */
  async createDataLake(
    req: CreateDataLakeRequest,
    options?: CallOptions,
  ): Promise<DataLake> {
    const response = await this.inner.createDataLake(
      CreateDataLakeRequest.encode(req),
      options,
    );
    return DataLake.decode(response);
  }

  /**
   * Gets a data lake by name.
   * @param req - The get data lake request containing the name (format: `tenants/{tenant}/data-lakes/{data-lake}`).
   * @param options - Optional gRPC call options.
   * @returns The requested data lake.
   */
  async getDataLake(
    req: GetDataLakeRequest,
    options?: CallOptions,
  ): Promise<DataLake> {
    const response = await this.inner.getDataLake(
      GetDataLakeRequest.encode(req),
      options,
    );
    return DataLake.decode(response);
  }

  /**
   * Lists all data lakes within a tenant with pagination support.
   * @param req - The list data lakes request with parent tenant, optional pageSize (default: 100, max: 1000), and pageToken.
   * @param options - Optional gRPC call options.
   * @returns A paginated list of data lakes.
   */
  async listDataLakes(
    req: ListDataLakesRequest,
    options?: CallOptions,
  ): Promise<ListDataLakesResponse> {
    const response = await this.inner.listDataLakes(
      ListDataLakesRequest.encode(req),
      options,
    );
    return ListDataLakesResponse.decode(response);
  }

  /**
   * Deletes a data lake.
   * @param req - The delete data lake request containing the name (format: `tenants/{tenant}/data-lakes/{data-lake}`).
   * @param options - Optional gRPC call options.
   */
  async deleteDataLake(
    req: DeleteDataLakeRequest,
    options?: CallOptions,
  ): Promise<void> {
    await this.inner.deleteDataLake(DeleteDataLakeRequest.encode(req), options);
  }

  // ------- NAMESPACE --------

  /**
   * Creates a new namespace within a tenant.
   * @param req - The create namespace request containing the parent tenant, namespace id, and metadata.
   * @param options - Optional gRPC call options.
   * @returns The created namespace.
   */
  async createNamespace(
    req: CreateNamespaceRequest,
    options?: CallOptions,
  ): Promise<Namespace> {
    const response = await this.inner.createNamespace(
      CreateNamespaceRequest.encode(req),
      options,
    );
    return Namespace.decode(response);
  }

  /**
   * Gets a namespace by name.
   * @param req - The get namespace request containing the name (format: `tenants/{tenant}/namespaces/{namespace}`).
   * @param options - Optional gRPC call options.
   * @returns The requested namespace.
   */
  async getNamespace(
    req: GetNamespaceRequest,
    options?: CallOptions,
  ): Promise<Namespace> {
    const response = await this.inner.getNamespace(
      GetNamespaceRequest.encode(req),
      options,
    );
    return Namespace.decode(response);
  }

  /**
   * Lists all namespaces within a tenant with pagination support.
   * @param req - The list namespaces request with parent tenant, optional pageSize (default: 100, max: 1000), and pageToken.
   * @param options - Optional gRPC call options.
   * @returns A paginated list of namespaces.
   */
  async listNamespaces(
    req: ListNamespacesRequest,
    options?: CallOptions,
  ): Promise<ListNamespacesResponse> {
    const response = await this.inner.listNamespaces(
      ListNamespacesRequest.encode(req),
      options,
    );
    return ListNamespacesResponse.decode(response);
  }

  /**
   * Deletes a namespace.
   * @param req - The delete namespace request containing the name (format: `tenants/{tenant}/namespaces/{namespace}`).
   * @param options - Optional gRPC call options.
   */
  async deleteNamespace(
    req: DeleteNamespaceRequest,
    options?: CallOptions,
  ): Promise<void> {
    await this.inner.deleteNamespace(
      DeleteNamespaceRequest.encode(req),
      options,
    );
  }

  // ------- TOPIC -------

  /**
   * Creates a new topic within a namespace.
   * @param req - The create topic request containing the parent namespace, topic id, and topic metadata (fields, compaction config, etc.).
   * @param options - Optional gRPC call options.
   * @returns The created topic.
   */
  async createTopic(
    req: CreateTopicRequest,
    options?: CallOptions,
  ): Promise<Topic> {
    const response = await this.inner.createTopic(
      CreateTopicRequest.encode(req),
      options,
    );
    return Topic.decode(response);
  }

  /**
   * Gets a topic by name.
   * @param req - The get topic request containing the name (format: `tenants/{tenant}/namespaces/{namespace}/topics/{topic}`).
   * @param options - Optional gRPC call options.
   * @returns The requested topic.
   */
  async getTopic(req: GetTopicRequest, options?: CallOptions): Promise<Topic> {
    const response = await this.inner.getTopic(
      GetTopicRequest.encode(req),
      options,
    );
    return Topic.decode(response);
  }

  /**
   * Lists all topics within a namespace with pagination support.
   * @param req - The list topics request with parent namespace, optional pageSize (default: 100, max: 1000), and pageToken.
   * @param options - Optional gRPC call options.
   * @returns A paginated list of topics.
   */
  async listTopics(
    req: ListTopicsRequest,
    options?: CallOptions,
  ): Promise<ListTopicsResponse> {
    const response = await this.inner.listTopics(
      ListTopicsRequest.encode(req),
      options,
    );
    return ListTopicsResponse.decode(response);
  }

  /**
   * Deletes a topic.
   * @param req - The delete topic request containing the name (format: `tenants/{tenant}/namespaces/{namespace}/topics/{topic}`) and optional force flag to delete associated data.
   * @param options - Optional gRPC call options.
   */
  async deleteTopic(
    req: DeleteTopicRequest,
    options?: CallOptions,
  ): Promise<void> {
    await this.inner.deleteTopic(DeleteTopicRequest.encode(req), options);
  }
}
