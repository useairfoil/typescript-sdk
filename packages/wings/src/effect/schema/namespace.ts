import { Schema } from "effect";
import type * as proto from "../../proto/cluster_metadata";

export const CreateNamespaceRequest = Schema.Struct({
  /**
   * The tenant that owns the namespace.
   *
   * Format: tenants/{tenant}
   */
  parent: Schema.String,
  /** The namespace id. */
  namespaceId: Schema.String,
  /** The size at which the current segment is flushed to object storage. */
  flushSizeBytes: Schema.BigIntFromSelf,
  /** The maximum interval at which the current segment is flushed to object storage (in milliseconds). */
  flushIntervalMillis: Schema.BigIntFromSelf,
  /** The object store used by this namespace. */
  objectStore: Schema.String,
  /** The data lake used by this namespace. */
  dataLake: Schema.String,
});

export type CreateNamespaceRequest = typeof CreateNamespaceRequest.Type;

export const GetNamespaceRequest = Schema.Struct({
  /**
   * The namespace name.
   *
   * Format: tenants/{tenant}/namespaces/{namespace}
   */
  name: Schema.String,
});

export type GetNamespaceRequest = typeof GetNamespaceRequest.Type;

export const ListNamespacesRequest = Schema.Struct({
  /**
   * The tenant name.
   *
   * Format: tenants/{tenant}
   */
  parent: Schema.String,
  /** The number of namespaces to return. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

export type ListNamespacesRequest = typeof ListNamespacesRequest.Type;

export const Namespace = Schema.Struct({
  /**
   * The namespace name.
   *
   * Format: tenants/{tenant}/namespaces/{namespace}
   */
  name: Schema.String,
  /** The size at which the current segment is flushed to object storage. */
  flushSizeBytes: Schema.BigIntFromSelf,
  /** The maximum interval at which the current segment is flushed to object storage (in milliseconds). */
  flushIntervalMillis: Schema.BigIntFromSelf,
  /** The object store used by this namespace. */
  objectStore: Schema.String,
  /** The data lake used by this namespace. */
  dataLake: Schema.String,
});

export type Namespace = typeof Namespace.Type;

export const ListNamespacesResponse = Schema.Struct({
  /** The namespaces. */
  namespaces: Schema.Array(Namespace),
  /** The continuation token. */
  nextPageToken: Schema.String,
});

export type ListNamespacesResponse = typeof ListNamespacesResponse.Type;

export const DeleteNamespaceRequest = Schema.Struct({
  /**
   * The namespace name.
   *
   * Format: tenants/{tenant}/namespaces/{namespace}
   */
  name: Schema.String,
});

export type DeleteNamespaceRequest = typeof DeleteNamespaceRequest.Type;

export const Codec = {
  CreateNamespaceRequest: {
    toProto: (value: CreateNamespaceRequest): proto.CreateNamespaceRequest => ({
      $type: "wings.v1.cluster_metadata.CreateNamespaceRequest",
      parent: value.parent,
      namespaceId: value.namespaceId,
      namespace: {
        $type: "wings.v1.cluster_metadata.Namespace",
        name: `${value.parent}/namespaces/${value.namespaceId}`,
        flushSizeBytes: value.flushSizeBytes,
        flushIntervalMillis: value.flushIntervalMillis,
        objectStore: value.objectStore,
        dataLake: value.dataLake,
      },
    }),
    fromProto: (
      value: proto.CreateNamespaceRequest,
    ): CreateNamespaceRequest => {
      if (value.namespace === undefined) {
        throw new Error("Namespace metadata is undefined");
      }
      return {
        parent: value.parent,
        namespaceId: value.namespaceId,
        flushSizeBytes: value.namespace.flushSizeBytes,
        flushIntervalMillis: value.namespace.flushIntervalMillis,
        objectStore: value.namespace.objectStore,
        dataLake: value.namespace.dataLake,
      };
    },
  },

  Namespace: {
    toProto: (value: Namespace): proto.Namespace => ({
      $type: "wings.v1.cluster_metadata.Namespace",
      name: value.name,
      flushSizeBytes: value.flushSizeBytes,
      flushIntervalMillis: value.flushIntervalMillis,
      objectStore: value.objectStore,
      dataLake: value.dataLake,
    }),
    fromProto: (value: proto.Namespace): Namespace => ({
      name: value.name,
      flushSizeBytes: value.flushSizeBytes,
      flushIntervalMillis: value.flushIntervalMillis,
      objectStore: value.objectStore,
      dataLake: value.dataLake,
    }),
  },

  GetNamespaceRequest: {
    toProto: (value: GetNamespaceRequest): proto.GetNamespaceRequest => ({
      $type: "wings.v1.cluster_metadata.GetNamespaceRequest",
      name: value.name,
    }),
    fromProto: (value: proto.GetNamespaceRequest): GetNamespaceRequest => ({
      name: value.name,
    }),
  },

  ListNamespacesRequest: {
    toProto: (value: ListNamespacesRequest): proto.ListNamespacesRequest => ({
      $type: "wings.v1.cluster_metadata.ListNamespacesRequest",
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
    fromProto: (value: proto.ListNamespacesRequest): ListNamespacesRequest => ({
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
  },

  ListNamespacesResponse: {
    toProto: (value: ListNamespacesResponse): proto.ListNamespacesResponse => ({
      $type: "wings.v1.cluster_metadata.ListNamespacesResponse",
      namespaces: value.namespaces.map(Codec.Namespace.toProto),
      nextPageToken: value.nextPageToken,
    }),
    fromProto: (
      value: proto.ListNamespacesResponse,
    ): ListNamespacesResponse => ({
      namespaces: value.namespaces.map(Codec.Namespace.fromProto),
      nextPageToken: value.nextPageToken,
    }),
  },

  DeleteNamespaceRequest: {
    toProto: (value: DeleteNamespaceRequest): proto.DeleteNamespaceRequest => ({
      $type: "wings.v1.cluster_metadata.DeleteNamespaceRequest",
      name: value.name,
    }),
    fromProto: (
      value: proto.DeleteNamespaceRequest,
    ): DeleteNamespaceRequest => ({
      name: value.name,
    }),
  },
} as const;
