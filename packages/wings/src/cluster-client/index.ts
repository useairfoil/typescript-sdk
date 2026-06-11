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

/** Creates a new namespace. */
export const createNamespace = (...args: ClusterClientFnParams<"createNamespace">) =>
  ClusterClient.use((service) => service.createNamespace(...args));

/** Updates an existing namespace. */
export const updateNamespace = (...args: ClusterClientFnParams<"updateNamespace">) =>
  ClusterClient.use((service) => service.updateNamespace(...args));

/** Gets a namespace by name. */
export const getNamespace = (...args: ClusterClientFnParams<"getNamespace">) =>
  ClusterClient.use((service) => service.getNamespace(...args));

/** Lists namespaces with pagination. */
export const listNamespaces = (...args: ClusterClientFnParams<"listNamespaces">) =>
  ClusterClient.use((service) => service.listNamespaces(...args));

/** Deletes a namespace. */
export const deleteNamespace = (...args: ClusterClientFnParams<"deleteNamespace">) =>
  ClusterClient.use((service) => service.deleteNamespace(...args));

/** Creates a new table. */
export const createTable = (...args: ClusterClientFnParams<"createTable">) =>
  ClusterClient.use((service) => service.createTable(...args));

/** Gets a table by name. */
export const getTable = (...args: ClusterClientFnParams<"getTable">) =>
  ClusterClient.use((service) => service.getTable(...args));

/** Lists tables with pagination. */
export const listTables = (...args: ClusterClientFnParams<"listTables">) =>
  ClusterClient.use((service) => service.listTables(...args));

/** Deletes a table. */
export const deleteTable = (...args: ClusterClientFnParams<"deleteTable">) =>
  ClusterClient.use((service) => service.deleteTable(...args));
