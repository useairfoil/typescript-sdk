import type { CallOptions } from "nice-grpc";

import { Context, type Effect } from "effect";

import type * as ClusterSchema from "../cluster";
import type { ClusterClientError } from "../errors";
import type { ClusterServiceClient } from "../proto/wings/cluster";

/**
 * ClusterClient Service Interface
 */
export interface ClusterClientService {
  /**
   * Returns the underlying gRPC client that works with protobuf types.
   *
   * Use this for advanced use cases when you need direct access to the protobuf
   * client instead of the Effect Schema-based API.
   */
  readonly getProtobufClient: () => ClusterServiceClient;

  /** Creates a new namespace. */
  readonly createNamespace: (
    req: ClusterSchema.Namespace.CreateNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.Namespace, ClusterClientError>;

  /** Updates an existing namespace. */
  readonly updateNamespace: (
    req: ClusterSchema.Namespace.UpdateNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.Namespace, ClusterClientError>;

  /** Gets a namespace by name. */
  readonly getNamespace: (
    req: ClusterSchema.Namespace.GetNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.Namespace, ClusterClientError>;

  /** Lists namespaces with pagination. */
  readonly listNamespaces: (
    req: ClusterSchema.Namespace.ListNamespacesRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Namespace.ListNamespacesResponse, ClusterClientError>;

  /** Deletes a namespace. */
  readonly deleteNamespace: (
    req: ClusterSchema.Namespace.DeleteNamespaceRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterClientError>;

  /** Creates a new table. */
  readonly createTable: (
    req: ClusterSchema.Table.CreateTableRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Table.Table, ClusterClientError>;

  /** Gets a table by name. */
  readonly getTable: (
    req: ClusterSchema.Table.GetTableRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Table.Table, ClusterClientError>;

  /** Lists tables with pagination. */
  readonly listTables: (
    req: ClusterSchema.Table.ListTablesRequest,
    options?: CallOptions,
  ) => Effect.Effect<ClusterSchema.Table.ListTablesResponse, ClusterClientError>;

  /** Deletes a table. */
  readonly deleteTable: (
    req: ClusterSchema.Table.DeleteTableRequest,
    options?: CallOptions,
  ) => Effect.Effect<void, ClusterClientError>;
}

/**
 * ClusterClient Service Tag
 *
 * Used to provide and access the ClusterClient service in the Effect context.
 */
export class ClusterClient extends Context.Service<ClusterClient, ClusterClientService>()(
  "@useairfoil/wings/ClusterClient",
) {}
