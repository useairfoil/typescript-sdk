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

import { Config, Context, Effect, Layer } from "effect";
import { IcebergRestCatalog } from "iceberg-js";

import type { IcebergError } from "./errors";

import { mapIcebergError } from "./errors";

export interface Service {
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
  readonly loadConfig: () => Effect.Effect<CatalogConfig, IcebergError>;

  /** Lists all namespaces in the catalog. */
  readonly listNamespaces: (
    options?: ListNamespacesOptions,
  ) => Effect.Effect<ListNamespacesResult, IcebergError>;

  /** Creates a new namespace in the catalog. */
  readonly createNamespace: (
    id: NamespaceIdentifier,
    metadata?: NamespaceMetadata,
  ) => Effect.Effect<CreateNamespaceResponse, IcebergError>;

  /**
   * Drops a namespace from the catalog.
   *
   * The namespace must be empty before it can be dropped.
   */
  readonly dropNamespace: (id: NamespaceIdentifier) => Effect.Effect<void, IcebergError>;

  /** Loads metadata for a namespace. */
  readonly loadNamespaceMetadata: (
    id: NamespaceIdentifier,
  ) => Effect.Effect<NamespaceMetadata, IcebergError>;

  /** Sets or removes properties on a namespace. */
  readonly updateNamespaceProperties: (
    id: NamespaceIdentifier,
    request: UpdateNamespacePropertiesRequest,
  ) => Effect.Effect<UpdateNamespacePropertiesResponse, IcebergError>;

  /** Lists tables in a namespace. */
  readonly listTables: (
    namespace: NamespaceIdentifier,
    options?: ListTablesOptions,
  ) => Effect.Effect<ListTablesResult, IcebergError>;

  /** Creates a new table in the catalog. */
  readonly createTable: (
    namespace: NamespaceIdentifier,
    request: CreateTableRequest,
  ) => Effect.Effect<TableMetadata, IcebergError>;

  /**
   * Creates a table and returns the full spec-aligned `LoadTableResult`, including
   * server config, storage credentials, and the response ETag.
   */
  readonly createTableResult: (
    namespace: NamespaceIdentifier,
    request: CreateTableRequest,
  ) => Effect.Effect<LoadTableResultWithEtag, IcebergError>;

  /** Commits updates to a table using the spec-aligned `{ requirements, updates }` shape. */
  readonly updateTable: (
    id: TableIdentifier,
    request: UpdateTableRequest,
  ) => Effect.Effect<CommitTableResponse, IcebergError>;

  /** Spec-aligned alias for `updateTable`. */
  readonly commitTable: (
    id: TableIdentifier,
    request: CommitTableRequest,
  ) => Effect.Effect<CommitTableResponse, IcebergError>;

  /** Drops a table from the catalog. */
  readonly dropTable: (
    id: TableIdentifier,
    options?: DropTableRequest,
  ) => Effect.Effect<void, IcebergError>;

  /**
   * Loads metadata for a table.
   *
   * Pass `ifNoneMatch` in options to perform a conditional GET. If the server
   * returns 304 Not Modified, the result is `null`.
   */
  readonly loadTable: {
    (id: TableIdentifier): Effect.Effect<TableMetadata, IcebergError>;
    (
      id: TableIdentifier,
      options: LoadTableOptions,
    ): Effect.Effect<TableMetadata | null, IcebergError>;
  };

  /**
   * Loads the full spec-aligned `LoadTableResult`, including server config,
   * storage credentials, and the response ETag. Returns `null` on 304.
   */
  readonly loadTableResult: (
    id: TableIdentifier,
    options?: LoadTableOptions,
  ) => Effect.Effect<LoadTableResultWithEtag | null, IcebergError>;

  /** Checks if a namespace exists in the catalog. */
  readonly namespaceExists: (id: NamespaceIdentifier) => Effect.Effect<boolean, IcebergError>;

  /** Checks if a table exists in the catalog. */
  readonly tableExists: (id: TableIdentifier) => Effect.Effect<boolean, IcebergError>;

  /** Creates a namespace if it does not exist. */
  readonly createNamespaceIfNotExists: (
    id: NamespaceIdentifier,
    metadata?: NamespaceMetadata,
  ) => Effect.Effect<CreateNamespaceResponse | void, IcebergError>;

  /** Creates a table if it does not exist. */
  readonly createTableIfNotExists: (
    namespace: NamespaceIdentifier,
    request: CreateTableRequest,
  ) => Effect.Effect<TableMetadata, IcebergError>;

  /** Registers an existing metadata file as a table in the given namespace. */
  readonly registerTable: (
    namespace: NamespaceIdentifier,
    request: RegisterTableRequest,
  ) => Effect.Effect<TableMetadata, IcebergError>;

  /** Returns the full spec-aligned `LoadTableResult` for `registerTable`. */
  readonly registerTableResult: (
    namespace: NamespaceIdentifier,
    request: RegisterTableRequest,
  ) => Effect.Effect<LoadTableResultWithEtag, IcebergError>;

  /** Renames a table. Servers may or may not support cross-namespace renames. */
  readonly renameTable: (request: RenameTableRequest) => Effect.Effect<void, IcebergError>;
}

/** Service for the Effect wrapper around `iceberg-js`'s `IcebergRestCatalog`. */
export class IcebergCatalog extends Context.Service<IcebergCatalog, Service>()(
  "@useairfoil/effect-iceberg/IcebergCatalog",
) {}

const tryCatalog = <A>(evaluate: () => Promise<A>): Effect.Effect<A, IcebergError> =>
  Effect.tryPromise({
    try: evaluate,
    catch: mapIcebergError,
  });

/** Creates an `IcebergCatalog` service from `iceberg-js` catalog options. */
export const make = (options: IcebergRestCatalogOptions): Service => {
  const catalog = new IcebergRestCatalog(options);

  function loadTable(id: TableIdentifier): Effect.Effect<TableMetadata, IcebergError>;
  function loadTable(
    id: TableIdentifier,
    loadOptions: LoadTableOptions,
  ): Effect.Effect<TableMetadata | null, IcebergError>;
  function loadTable(id: TableIdentifier, loadOptions?: LoadTableOptions) {
    return tryCatalog(() =>
      loadOptions === undefined ? catalog.loadTable(id) : catalog.loadTable(id, loadOptions),
    );
  }

  return IcebergCatalog.of({
    getCatalogClient: () => catalog,
    loadConfig: () => tryCatalog(() => catalog.loadConfig()),

    listNamespaces: (listOptions) => tryCatalog(() => catalog.listNamespaces(listOptions)),
    createNamespace: (id, metadata) => tryCatalog(() => catalog.createNamespace(id, metadata)),
    dropNamespace: (id) => tryCatalog(() => catalog.dropNamespace(id)),
    loadNamespaceMetadata: (id) => tryCatalog(() => catalog.loadNamespaceMetadata(id)),
    updateNamespaceProperties: (id, request) =>
      tryCatalog(() => catalog.updateNamespaceProperties(id, request)),

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

const service = Effect.service(IcebergCatalog);

export const getCatalogClient: Effect.Effect<IcebergRestCatalog, never, IcebergCatalog> =
  Effect.map(service, (catalog) => catalog.getCatalogClient());

export const loadConfig: Effect.Effect<CatalogConfig, IcebergError, IcebergCatalog> =
  Effect.flatMap(service, (catalog) => catalog.loadConfig());

export const listNamespaces = (
  options?: ListNamespacesOptions,
): Effect.Effect<ListNamespacesResult, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.listNamespaces(options));

export const createNamespace = (
  id: NamespaceIdentifier,
  metadata?: NamespaceMetadata,
): Effect.Effect<CreateNamespaceResponse, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.createNamespace(id, metadata));

export const dropNamespace = (
  id: NamespaceIdentifier,
): Effect.Effect<void, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.dropNamespace(id));

export const loadNamespaceMetadata = (
  id: NamespaceIdentifier,
): Effect.Effect<NamespaceMetadata, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.loadNamespaceMetadata(id));

export const updateNamespaceProperties = (
  id: NamespaceIdentifier,
  request: UpdateNamespacePropertiesRequest,
): Effect.Effect<UpdateNamespacePropertiesResponse, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.updateNamespaceProperties(id, request));

export const listTables = (
  namespace: NamespaceIdentifier,
  options?: ListTablesOptions,
): Effect.Effect<ListTablesResult, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.listTables(namespace, options));

export const createTable = (
  namespace: NamespaceIdentifier,
  request: CreateTableRequest,
): Effect.Effect<TableMetadata, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.createTable(namespace, request));

export const createTableResult = (
  namespace: NamespaceIdentifier,
  request: CreateTableRequest,
): Effect.Effect<LoadTableResultWithEtag, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.createTableResult(namespace, request));

export const updateTable = (
  id: TableIdentifier,
  request: UpdateTableRequest,
): Effect.Effect<CommitTableResponse, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.updateTable(id, request));

export const commitTable = (
  id: TableIdentifier,
  request: CommitTableRequest,
): Effect.Effect<CommitTableResponse, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.commitTable(id, request));

export const dropTable = (
  id: TableIdentifier,
  options?: DropTableRequest,
): Effect.Effect<void, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.dropTable(id, options));

export function loadTable(
  id: TableIdentifier,
): Effect.Effect<TableMetadata, IcebergError, IcebergCatalog>;
export function loadTable(
  id: TableIdentifier,
  options: LoadTableOptions,
): Effect.Effect<TableMetadata | null, IcebergError, IcebergCatalog>;
export function loadTable(id: TableIdentifier, options?: LoadTableOptions) {
  return Effect.flatMap(service, (catalog) =>
    options === undefined ? catalog.loadTable(id) : catalog.loadTable(id, options),
  );
}

export const loadTableResult = (
  id: TableIdentifier,
  options?: LoadTableOptions,
): Effect.Effect<LoadTableResultWithEtag | null, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.loadTableResult(id, options));

export const namespaceExists = (
  id: NamespaceIdentifier,
): Effect.Effect<boolean, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.namespaceExists(id));

export const tableExists = (
  id: TableIdentifier,
): Effect.Effect<boolean, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.tableExists(id));

export const createNamespaceIfNotExists = (
  id: NamespaceIdentifier,
  metadata?: NamespaceMetadata,
): Effect.Effect<CreateNamespaceResponse | void, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.createNamespaceIfNotExists(id, metadata));

export const createTableIfNotExists = (
  namespace: NamespaceIdentifier,
  request: CreateTableRequest,
): Effect.Effect<TableMetadata, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.createTableIfNotExists(namespace, request));

export const registerTable = (
  namespace: NamespaceIdentifier,
  request: RegisterTableRequest,
): Effect.Effect<TableMetadata, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.registerTable(namespace, request));

export const registerTableResult = (
  namespace: NamespaceIdentifier,
  request: RegisterTableRequest,
): Effect.Effect<LoadTableResultWithEtag, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.registerTableResult(namespace, request));

export const renameTable = (
  request: RenameTableRequest,
): Effect.Effect<void, IcebergError, IcebergCatalog> =>
  Effect.flatMap(service, (catalog) => catalog.renameTable(request));

/** Creates an `IcebergCatalog` layer from concrete `iceberg-js` catalog options. */
export const layer = (options: IcebergRestCatalogOptions): Layer.Layer<IcebergCatalog> =>
  Layer.succeed(IcebergCatalog)(make(options));

/** Creates an `IcebergCatalog` layer from Effect `Config` values. */
export const layerConfig = (
  config: Config.Wrap<IcebergRestCatalogOptions>,
): Layer.Layer<IcebergCatalog, Config.ConfigError> =>
  Layer.effect(
    IcebergCatalog,
    Effect.gen(function* () {
      const options = yield* Config.unwrap(config);
      return make(options);
    }),
  );
