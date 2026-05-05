import { ClusterClient, type ClusterClientService } from "./service";

export type { ClusterClientOptions } from "./config";

export { layer, layerConfig, make } from "./layer";

export { ClusterClient, type ClusterClientService } from "./service";

type ClusterClientFnParams<T extends keyof ClusterClientService> = Parameters<
  ClusterClientService[T]
>;

/**
 * Access the underlying protobuf client.
 * Most applications should prefer the higher-level ClusterClient helpers.
 */
export const getProtobufClient = () =>
  ClusterClient.useSync((service) => service.getProtobufClient());

/**
 * Creates a new tenant.
 */
export const createTenant = (...args: ClusterClientFnParams<"createTenant">) =>
  ClusterClient.use((service) => service.createTenant(...args));

/**
 * Gets a tenant by name.
 */
export const getTenant = (...args: ClusterClientFnParams<"getTenant">) =>
  ClusterClient.use((service) => service.getTenant(...args));

/**
 * Lists tenants with pagination.
 */
export const listTenants = (...args: ClusterClientFnParams<"listTenants">) =>
  ClusterClient.use((service) => service.listTenants(...args));

/**
 * Deletes a tenant.
 */
export const deleteTenant = (...args: ClusterClientFnParams<"deleteTenant">) =>
  ClusterClient.use((service) => service.deleteTenant(...args));

/**
 * Creates a new namespace.
 */
export const createNamespace = (...args: ClusterClientFnParams<"createNamespace">) =>
  ClusterClient.use((service) => service.createNamespace(...args));

/**
 * Gets a namespace by name.
 */
export const getNamespace = (...args: ClusterClientFnParams<"getNamespace">) =>
  ClusterClient.use((service) => service.getNamespace(...args));

/**
 * Lists namespaces with pagination.
 */
export const listNamespaces = (...args: ClusterClientFnParams<"listNamespaces">) =>
  ClusterClient.use((service) => service.listNamespaces(...args));

/**
 * Deletes a namespace.
 */
export const deleteNamespace = (...args: ClusterClientFnParams<"deleteNamespace">) =>
  ClusterClient.use((service) => service.deleteNamespace(...args));

/** Creates a new topic. */
export const createTopic = (...args: ClusterClientFnParams<"createTopic">) =>
  ClusterClient.use((service) => service.createTopic(...args));

/** Gets a topic by name. */
export const getTopic = (...args: ClusterClientFnParams<"getTopic">) =>
  ClusterClient.use((service) => service.getTopic(...args));

/** Lists topics with pagination. */
export const listTopics = (...args: ClusterClientFnParams<"listTopics">) =>
  ClusterClient.use((service) => service.listTopics(...args));

/** Deletes a topic. */
export const deleteTopic = (...args: ClusterClientFnParams<"deleteTopic">) =>
  ClusterClient.use((service) => service.deleteTopic(...args));

/** Creates a new object store. */
export const createObjectStore = (...args: ClusterClientFnParams<"createObjectStore">) =>
  ClusterClient.use((service) => service.createObjectStore(...args));

/** Gets an object store by name. */
export const getObjectStore = (...args: ClusterClientFnParams<"getObjectStore">) =>
  ClusterClient.use((service) => service.getObjectStore(...args));

/** Lists object stores with pagination. */
export const listObjectStores = (...args: ClusterClientFnParams<"listObjectStores">) =>
  ClusterClient.use((service) => service.listObjectStores(...args));

/** Deletes an object store. */
export const deleteObjectStore = (...args: ClusterClientFnParams<"deleteObjectStore">) =>
  ClusterClient.use((service) => service.deleteObjectStore(...args));

/** Creates a new data lake. */
export const createDataLake = (...args: ClusterClientFnParams<"createDataLake">) =>
  ClusterClient.use((service) => service.createDataLake(...args));

/** Gets a data lake by name. */
export const getDataLake = (...args: ClusterClientFnParams<"getDataLake">) =>
  ClusterClient.use((service) => service.getDataLake(...args));

/** Lists data lakes with pagination. */
export const listDataLakes = (...args: ClusterClientFnParams<"listDataLakes">) =>
  ClusterClient.use((service) => service.listDataLakes(...args));

/** Deletes a data lake. */
export const deleteDataLake = (...args: ClusterClientFnParams<"deleteDataLake">) =>
  ClusterClient.use((service) => service.deleteDataLake(...args));
