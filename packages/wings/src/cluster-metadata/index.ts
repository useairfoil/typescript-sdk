import { Effect } from "effect";
import { ClusterMetadata } from "./service";

export type { ClusterMetadataParams } from "./config";

export { layer, layerConfig, make } from "./layer";

export { ClusterMetadata, type ClusterMetadataService } from "./service";

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
  Effect.map(ClusterMetadata, (service) => service.getProtobufClient());

/**
 * Creates a new tenant.
 * @param req - The create tenant request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created tenant
 */
export const createTenant = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.createTenant,
);

/**
 * Gets a tenant by name.
 * @param req - The get tenant request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the tenant
 */
export const getTenant = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.getTenant,
);

/**
 * Lists tenants with pagination.
 * @param req - The list tenants request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of tenants
 */
export const listTenants = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.listTenants,
);

/**
 * Deletes a tenant.
 * @param req - The delete tenant request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteTenant = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.deleteTenant,
);

/**
 * Creates a new namespace.
 * @param req - The create namespace request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created namespace
 */
export const createNamespace = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.createNamespace,
);

/**
 * Gets a namespace by name.
 * @param req - The get namespace request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the namespace
 */
export const getNamespace = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.getNamespace,
);

/**
 * Lists namespaces with pagination.
 * @param req - The list namespaces request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of namespaces
 */
export const listNamespaces = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.listNamespaces,
);

/**
 * Deletes a namespace.
 * @param req - The delete namespace request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteNamespace = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.deleteNamespace,
);

/**
 * Creates a new topic.
 * @param req - The create topic request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created topic
 */
export const createTopic = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.createTopic,
);

/**
 * Gets a topic by name.
 * @param req - The get topic request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the topic
 */
export const getTopic = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.getTopic,
);

/**
 * Lists topics with pagination.
 * @param req - The list topics request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of topics
 */
export const listTopics = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.listTopics,
);

/**
 * Deletes a topic.
 * @param req - The delete topic request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteTopic = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.deleteTopic,
);

/**
 * Creates a new object store.
 * @param req - The create object store request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created object store
 */
export const createObjectStore = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.createObjectStore,
);

/**
 * Gets an object store by name.
 * @param req - The get object store request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the object store
 */
export const getObjectStore = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.getObjectStore,
);

/**
 * Lists object stores with pagination.
 * @param req - The list object stores request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of object stores
 */
export const listObjectStores = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.listObjectStores,
);

/**
 * Deletes an object store.
 * @param req - The delete object store request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteObjectStore = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.deleteObjectStore,
);

/**
 * Creates a new data lake.
 * @param req - The create data lake request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the created data lake
 */
export const createDataLake = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.createDataLake,
);

/**
 * Gets a data lake by name.
 * @param req - The get data lake request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the data lake
 */
export const getDataLake = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.getDataLake,
);

/**
 * Lists data lakes with pagination.
 * @param req - The list data lakes request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves to the list of data lakes
 */
export const listDataLakes = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.listDataLakes,
);

/**
 * Deletes a data lake.
 * @param req - The delete data lake request
 * @param options - Optional gRPC call options
 * @returns Effect that resolves when deletion is complete
 */
export const deleteDataLake = Effect.serviceFunctionEffect(
  ClusterMetadata,
  (service) => service.deleteDataLake,
);
