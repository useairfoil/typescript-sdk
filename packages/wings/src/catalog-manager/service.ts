import type { IcebergCatalog } from "@useairfoil/effect-iceberg";

import { Context, type Effect, type Scope } from "effect";

import type { Ingestor, IngestorError, IngestorOptions } from "../ingestor";
import type { CatalogManagerError } from "./error";
import type { Catalog, CreateCatalogRequest } from "./schema";

/** Effect service for managing catalogs. */
export interface CatalogManagerService {
  /** Opens a scoped ingestor for a Wings table. */
  readonly ingestor: (
    options: IngestorOptions,
  ) => Effect.Effect<Ingestor, IngestorError, Scope.Scope>;

  /** Creates and validates a catalog. */
  readonly createCatalog: (
    request: CreateCatalogRequest,
  ) => Effect.Effect<Catalog, CatalogManagerError>;

  /** Gets a catalog by its bare ID. */
  readonly getCatalog: (id: string) => Effect.Effect<Catalog, CatalogManagerError>;

  /** Deletes a catalog by its bare ID. */
  readonly deleteCatalog: (id: string) => Effect.Effect<void, CatalogManagerError>;

  /**
   * Gets an Effect Iceberg REST catalog configured to use the Wings proxy for
   * the specified catalog.
   */
  readonly getIcebergCatalog: (
    id: string,
  ) => Effect.Effect<IcebergCatalog.Service, CatalogManagerError>;
}

/** Effect service tag for the Wings catalog management API. */
export class CatalogManager extends Context.Service<CatalogManager, CatalogManagerService>()(
  "@useairfoil/wings/CatalogManager",
) {}
