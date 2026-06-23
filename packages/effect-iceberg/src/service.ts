import type {
  CatalogConfig,
  CommitTableRequest,
  CommitTableResponse,
  CreateNamespaceResponse,
  CreateTableRequest,
  DropTableRequest,
  IcebergRestCatalogOptions,
  ListNamespacesOptions,
  ListNamespacesResult,
  ListTablesOptions,
  ListTablesResult,
  LoadTableOptions,
  LoadTableResultWithEtag,
  NamespaceIdentifier,
  NamespaceMetadata,
  RegisterTableRequest,
  RenameTableRequest,
  TableIdentifier,
  TableMetadata,
  UpdateNamespacePropertiesRequest,
  UpdateNamespacePropertiesResponse,
  UpdateTableRequest,
} from "iceberg-js";

import { Context, Effect } from "effect";
import { IcebergRestCatalog } from "iceberg-js";

import type { IcebergCatalogError } from "./errors";

import { toIcebergCatalogError } from "./errors";

export interface IcebergCatalogService {
  /**
   * Returns the underlying `iceberg-js` catalog client.
   *
   * Use this for advanced cases that need direct access to the Promise-based API.
   */
  readonly getCatalogClient: () => IcebergRestCatalog;

  /**
   * Fetch and cache the server's catalog configuration. Calling this is optional;
   * catalog operations trigger it lazily when a warehouse is configured.
   */
  readonly loadConfig: () => Effect.Effect<CatalogConfig, IcebergCatalogError>;

  /** Lists all namespaces in the catalog. */
  readonly listNamespaces: (
    options?: ListNamespacesOptions,
  ) => Effect.Effect<ListNamespacesResult, IcebergCatalogError>;

  /** Creates a new namespace in the catalog. */
  readonly createNamespace: (
    id: NamespaceIdentifier,
    metadata?: NamespaceMetadata,
  ) => Effect.Effect<CreateNamespaceResponse, IcebergCatalogError>;

  /**
   * Drops a namespace from the catalog.
   *
   * The namespace must be empty before it can be dropped.
   */
  readonly dropNamespace: (id: NamespaceIdentifier) => Effect.Effect<void, IcebergCatalogError>;

  /** Loads metadata for a namespace. */
  readonly loadNamespaceMetadata: (
    id: NamespaceIdentifier,
  ) => Effect.Effect<NamespaceMetadata, IcebergCatalogError>;

  /** Sets or removes properties on a namespace. */
  readonly updateNamespaceProperties: (
    id: NamespaceIdentifier,
    request: UpdateNamespacePropertiesRequest,
  ) => Effect.Effect<UpdateNamespacePropertiesResponse, IcebergCatalogError>;

  /** Lists tables in a namespace. */
  readonly listTables: (
    namespace: NamespaceIdentifier,
    options?: ListTablesOptions,
  ) => Effect.Effect<ListTablesResult, IcebergCatalogError>;

  /** Creates a new table in the catalog. */
  readonly createTable: (
    namespace: NamespaceIdentifier,
    request: CreateTableRequest,
  ) => Effect.Effect<TableMetadata, IcebergCatalogError>;

  /**
   * Creates a table and returns the full spec-aligned `LoadTableResult`, including
   * server config, storage credentials, and the response ETag.
   */
  readonly createTableResult: (
    namespace: NamespaceIdentifier,
    request: CreateTableRequest,
  ) => Effect.Effect<LoadTableResultWithEtag, IcebergCatalogError>;

  /** Commits updates to a table using the spec-aligned `{ requirements, updates }` shape. */
  readonly updateTable: (
    id: TableIdentifier,
    request: UpdateTableRequest,
  ) => Effect.Effect<CommitTableResponse, IcebergCatalogError>;

  /** Spec-aligned alias for `updateTable`. */
  readonly commitTable: (
    id: TableIdentifier,
    request: CommitTableRequest,
  ) => Effect.Effect<CommitTableResponse, IcebergCatalogError>;

  /** Drops a table from the catalog. */
  readonly dropTable: (
    id: TableIdentifier,
    options?: DropTableRequest,
  ) => Effect.Effect<void, IcebergCatalogError>;

  /**
   * Loads metadata for a table.
   *
   * Pass `ifNoneMatch` in options to perform a conditional GET. If the server
   * returns 304 Not Modified, the result is `null`.
   */
  readonly loadTable: {
    (id: TableIdentifier): Effect.Effect<TableMetadata, IcebergCatalogError>;
    (
      id: TableIdentifier,
      options: LoadTableOptions,
    ): Effect.Effect<TableMetadata | null, IcebergCatalogError>;
  };

  /**
   * Loads the full spec-aligned `LoadTableResult`, including server config,
   * storage credentials, and the response ETag. Returns `null` on 304.
   */
  readonly loadTableResult: (
    id: TableIdentifier,
    options?: LoadTableOptions,
  ) => Effect.Effect<LoadTableResultWithEtag | null, IcebergCatalogError>;

  /** Checks if a namespace exists in the catalog. */
  readonly namespaceExists: (
    id: NamespaceIdentifier,
  ) => Effect.Effect<boolean, IcebergCatalogError>;

  /** Checks if a table exists in the catalog. */
  readonly tableExists: (id: TableIdentifier) => Effect.Effect<boolean, IcebergCatalogError>;

  /** Creates a namespace if it does not exist. */
  readonly createNamespaceIfNotExists: (
    id: NamespaceIdentifier,
    metadata?: NamespaceMetadata,
  ) => Effect.Effect<CreateNamespaceResponse | void, IcebergCatalogError>;

  /** Creates a table if it does not exist. */
  readonly createTableIfNotExists: (
    namespace: NamespaceIdentifier,
    request: CreateTableRequest,
  ) => Effect.Effect<TableMetadata, IcebergCatalogError>;

  /** Registers an existing metadata file as a table in the given namespace. */
  readonly registerTable: (
    namespace: NamespaceIdentifier,
    request: RegisterTableRequest,
  ) => Effect.Effect<TableMetadata, IcebergCatalogError>;

  /** Returns the full spec-aligned `LoadTableResult` for `registerTable`. */
  readonly registerTableResult: (
    namespace: NamespaceIdentifier,
    request: RegisterTableRequest,
  ) => Effect.Effect<LoadTableResultWithEtag, IcebergCatalogError>;

  /** Renames a table. Servers may or may not support cross-namespace renames. */
  readonly renameTable: (request: RenameTableRequest) => Effect.Effect<void, IcebergCatalogError>;
}

/** Service tag for the Effect wrapper around `iceberg-js`'s `IcebergRestCatalog`. */
export class IcebergCatalog extends Context.Service<IcebergCatalog, IcebergCatalogService>()(
  "@useairfoil/effect-iceberg/IcebergCatalog",
) {}

const tryCatalog = <A>(evaluate: () => Promise<A>): Effect.Effect<A, IcebergCatalogError> =>
  Effect.tryPromise({
    try: evaluate,
    catch: toIcebergCatalogError,
  });

/** Creates an `IcebergCatalog` service from `iceberg-js` catalog options. */
export const make = (options: IcebergRestCatalogOptions): IcebergCatalogService => {
  const catalog = new IcebergRestCatalog(options);

  function loadTable(id: TableIdentifier): Effect.Effect<TableMetadata, IcebergCatalogError>;
  function loadTable(
    id: TableIdentifier,
    loadOptions: LoadTableOptions,
  ): Effect.Effect<TableMetadata | null, IcebergCatalogError>;
  function loadTable(id: TableIdentifier, loadOptions?: LoadTableOptions) {
    return tryCatalog(() =>
      loadOptions === undefined ? catalog.loadTable(id) : catalog.loadTable(id, loadOptions),
    );
  }

  return IcebergCatalog.of({
    // Client access and catalog configuration.
    getCatalogClient: () => catalog,
    loadConfig: () => tryCatalog(() => catalog.loadConfig()),

    // Namespace operations.
    listNamespaces: (listOptions) => tryCatalog(() => catalog.listNamespaces(listOptions)),
    createNamespace: (id, metadata) => tryCatalog(() => catalog.createNamespace(id, metadata)),
    dropNamespace: (id) => tryCatalog(() => catalog.dropNamespace(id)),
    loadNamespaceMetadata: (id) => tryCatalog(() => catalog.loadNamespaceMetadata(id)),
    updateNamespaceProperties: (id, request) =>
      tryCatalog(() => catalog.updateNamespaceProperties(id, request)),

    // Table operations.
    listTables: (namespace, listOptions) =>
      tryCatalog(() => catalog.listTables(namespace, listOptions)),
    createTable: (namespace, request) => tryCatalog(() => catalog.createTable(namespace, request)),
    createTableResult: (namespace, request) =>
      tryCatalog(() => catalog.createTableResult(namespace, request)),
    updateTable: (id, request) => tryCatalog(() => catalog.updateTable(id, request)),
    commitTable: (id, request) => tryCatalog(() => catalog.commitTable(id, request)),
    dropTable: (id, dropOptions) => tryCatalog(() => catalog.dropTable(id, dropOptions)),
    loadTable,
    loadTableResult: (id, loadOptions) =>
      tryCatalog(() => catalog.loadTableResult(id, loadOptions)),
    namespaceExists: (id) => tryCatalog(() => catalog.namespaceExists(id)),
    tableExists: (id) => tryCatalog(() => catalog.tableExists(id)),
    createNamespaceIfNotExists: (id, metadata) =>
      tryCatalog(() => catalog.createNamespaceIfNotExists(id, metadata)),
    createTableIfNotExists: (namespace, request) =>
      tryCatalog(() => catalog.createTableIfNotExists(namespace, request)),
    registerTable: (namespace, request) =>
      tryCatalog(() => catalog.registerTable(namespace, request)),
    registerTableResult: (namespace, request) =>
      tryCatalog(() => catalog.registerTableResult(namespace, request)),
    renameTable: (request) => tryCatalog(() => catalog.renameTable(request)),
  });
};
