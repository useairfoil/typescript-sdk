import { ClusterMetadata, type ClusterMetadataService } from "./service";

export type { ClusterMetadataParams } from "./config";

export { layer, layerConfig, make } from "./layer";

export { ClusterMetadata, type ClusterMetadataService } from "./service";

type ClusterMetadataFnParams<T extends keyof ClusterMetadataService> =
  Parameters<ClusterMetadataService[T]>;

/**
 * Access the underlying gRPC client that works with protobuf types.
 *
 * Use this for advanced use cases when you need direct access to the protobuf
 * client instead of the Effect Schema-based API. Note: for most use cases,
 * the Effect Schema API (like `getTopic`, `createTopic`, etc.) is preferred.
 *
 * @returns Effect that provides access to the protobuf ClusterMetadataServiceClient
 *
 */
export const getProtobufClient = () =>
  ClusterMetadata.useSync((service) => service.getProtobufClient());

/**
 * Creates a new tenant.
 * @param req - The create tenant request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created tenant
 */
export const createTenant = (
  ...args: ClusterMetadataFnParams<"createTenant">
) => ClusterMetadata.use((service) => service.createTenant(...args));

/**
 * Gets a tenant by name.
 * @param req - The get tenant request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the tenant
 */
export const getTenant = (...args: ClusterMetadataFnParams<"getTenant">) =>
  ClusterMetadata.use((service) => service.getTenant(...args));

/**
 * Lists tenants with pagination.
 * @param req - The list tenants request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of tenants
 */
export const listTenants = (...args: ClusterMetadataFnParams<"listTenants">) =>
  ClusterMetadata.use((service) => service.listTenants(...args));

/**
 * Deletes a tenant.
 * @param req - The delete tenant request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteTenant = (
  ...args: ClusterMetadataFnParams<"deleteTenant">
) => ClusterMetadata.use((service) => service.deleteTenant(...args));

/**
 * Creates a new namespace.
 * @param req - The create namespace request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created namespace
 */
export const createNamespace = (
  ...args: ClusterMetadataFnParams<"createNamespace">
) => ClusterMetadata.use((service) => service.createNamespace(...args));

/**
 * Gets a namespace by name.
 * @param req - The get namespace request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the namespace
 */
export const getNamespace = (
  ...args: ClusterMetadataFnParams<"getNamespace">
) => ClusterMetadata.use((service) => service.getNamespace(...args));

/**
 * Lists namespaces with pagination.
 * @param req - The list namespaces request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of namespaces
 */
export const listNamespaces = (
  ...args: ClusterMetadataFnParams<"listNamespaces">
) => ClusterMetadata.use((service) => service.listNamespaces(...args));

/**
 * Deletes a namespace.
 * @param req - The delete namespace request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteNamespace = (
  ...args: ClusterMetadataFnParams<"deleteNamespace">
) => ClusterMetadata.use((service) => service.deleteNamespace(...args));

/**
 * Creates a new topic.
 * @param req - The create topic request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created topic
 */
export const createTopic = (...args: ClusterMetadataFnParams<"createTopic">) =>
  ClusterMetadata.use((service) => service.createTopic(...args));

/**
 * Gets a topic by name.
 * @param req - The get topic request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the topic
 */
export const getTopic = (...args: ClusterMetadataFnParams<"getTopic">) =>
  ClusterMetadata.use((service) => service.getTopic(...args));

/**
 * Lists topics with pagination.
 * @param req - The list topics request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of topics
 */
export const listTopics = (...args: ClusterMetadataFnParams<"listTopics">) =>
  ClusterMetadata.use((service) => service.listTopics(...args));

/**
 * Deletes a topic.
 * @param req - The delete topic request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteTopic = (...args: ClusterMetadataFnParams<"deleteTopic">) =>
  ClusterMetadata.use((service) => service.deleteTopic(...args));

/**
 * Creates a new object store.
 * @param req - The create object store request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created object store
 */
export const createObjectStore = (
  ...args: ClusterMetadataFnParams<"createObjectStore">
) => ClusterMetadata.use((service) => service.createObjectStore(...args));

/**
 * Gets an object store by name.
 * @param req - The get object store request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the object store
 */
export const getObjectStore = (
  ...args: ClusterMetadataFnParams<"getObjectStore">
) => ClusterMetadata.use((service) => service.getObjectStore(...args));

/**
 * Lists object stores with pagination.
 * @param req - The list object stores request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of object stores
 */
export const listObjectStores = (
  ...args: ClusterMetadataFnParams<"listObjectStores">
) => ClusterMetadata.use((service) => service.listObjectStores(...args));

/**
 * Deletes an object store.
 * @param req - The delete object store request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteObjectStore = (
  ...args: ClusterMetadataFnParams<"deleteObjectStore">
) => ClusterMetadata.use((service) => service.deleteObjectStore(...args));

/**
 * Creates a new data lake.
 * @param req - The create data lake request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created data lake
 */
export const createDataLake = (
  ...args: ClusterMetadataFnParams<"createDataLake">
) => ClusterMetadata.use((service) => service.createDataLake(...args));

/**
 * Gets a data lake by name.
 * @param req - The get data lake request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the data lake
 */
export const getDataLake = (...args: ClusterMetadataFnParams<"getDataLake">) =>
  ClusterMetadata.use((service) => service.getDataLake(...args));

/**
 * Lists data lakes with pagination.
 * @param req - The list data lakes request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of data lakes
 */
export const listDataLakes = (
  ...args: ClusterMetadataFnParams<"listDataLakes">
) => ClusterMetadata.use((service) => service.listDataLakes(...args));

/**
 * Deletes a data lake.
 * @param req - The delete data lake request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteDataLake = (
  ...args: ClusterMetadataFnParams<"deleteDataLake">
) => ClusterMetadata.use((service) => service.deleteDataLake(...args));
