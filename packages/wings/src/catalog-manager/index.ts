import type { IcebergCatalog } from "@useairfoil/effect-iceberg";
import type { Effect } from "effect";

import { CatalogManagerError } from "./error";
import { CatalogManager, type CatalogManagerService } from "./service";

export type { CatalogManagerOptions } from "./config";
export { CatalogManagerError } from "./error";
export { layer, layerConfig, make } from "./layer";
export * from "./schema";
export { CatalogManager, type CatalogManagerService } from "./service";

type CatalogManagerFnParams<T extends keyof CatalogManagerService> = Parameters<
  CatalogManagerService[T]
>;

/** Creates and validates a catalog. */
export const createCatalog = (...args: CatalogManagerFnParams<"createCatalog">) =>
  CatalogManager.use((service) => service.createCatalog(...args));

/** Gets a catalog by its bare ID. */
export const getCatalog = (...args: CatalogManagerFnParams<"getCatalog">) =>
  CatalogManager.use((service) => service.getCatalog(...args));

/** Deletes a catalog by its bare ID. */
export const deleteCatalog = (...args: CatalogManagerFnParams<"deleteCatalog">) =>
  CatalogManager.use((service) => service.deleteCatalog(...args));

/** Gets an Effect Iceberg REST catalog configured for a Wings catalog. */
export const getIcebergCatalog = (
  ...args: CatalogManagerFnParams<"getIcebergCatalog">
): Effect.Effect<IcebergCatalog.Service, CatalogManagerError, CatalogManager> =>
  CatalogManager.use((service) => service.getIcebergCatalog(...args));
