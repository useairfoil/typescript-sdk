import type { Codec, CodecType } from "../lib/codec";
import type * as proto from "../proto/cluster_metadata";

export const CreateNamespaceRequest: Codec<
  {
    /**
     * The tenant that owns the namespace.
     *
     * Format: tenants/{tenant}
     */
    parent: string;
    /** The namespace id. */
    namespaceId: string;
    /** The size at which the current segment is flushed to object storage. */
    flushSizeBytes: bigint;
    /** The maximum interval at which the current segment is flushed to object storage (in milliseconds). */
    flushIntervalMillis: bigint;
    /** The object store used by this namespace. */
    objectStore: string;
    /** The data lake used by this namespace. */
    dataLake: string;
  },
  proto.CreateNamespaceRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.CreateNamespaceRequest",
      parent: value.parent,
      namespaceId: value.namespaceId,
      namespace: Namespace.encode({
        name: `${value.parent}/namespaces/${value.namespaceId}`,
        flushSizeBytes: value.flushSizeBytes,
        flushIntervalMillis: value.flushIntervalMillis,
        objectStore: value.objectStore,
        dataLake: value.dataLake,
      }),
    };
  },
  decode(value) {
    if (value.namespace === undefined) {
      throw new Error("Namespace metadata is undefined");
    }

    return {
      parent: value.parent,
      namespaceId: value.namespaceId,
      dataLake: value.namespace.dataLake,
      objectStore: value.namespace.objectStore,
      flushIntervalMillis: value.namespace.flushIntervalMillis,
      flushSizeBytes: value.namespace.flushSizeBytes,
    };
  },
};

export type CreateNamespaceRequest = CodecType<typeof CreateNamespaceRequest>;

export const GetNamespaceRequest: Codec<
  {
    /**
     * The namespace name.
     *
     * Format: tenants/{tenant}/namespaces/{namespace}
     */
    name: string;
  },
  proto.GetNamespaceRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.GetNamespaceRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type GetNamespaceRequest = CodecType<typeof GetNamespaceRequest>;

export const ListNamespacesRequest: Codec<
  {
    /**
     * The tenant name.
     *
     * Format: tenants/{tenant}
     */
    parent: string;
    /** The number of namespaces to return. */
    pageSize?: number;
    /** The continuation token. */
    pageToken?: string;
  },
  proto.ListNamespacesRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListNamespacesRequest",
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    };
  },
  decode(value) {
    return {
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    };
  },
};

export type ListNamespacesRequest = CodecType<typeof ListNamespacesRequest>;

export const ListNamespacesResponse: Codec<
  {
    /** The namespaces. */
    namespaces: Namespace[];
    /** The continuation token. */
    nextPageToken: string;
  },
  proto.ListNamespacesResponse
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListNamespacesResponse",
      namespaces: value.namespaces.map(Namespace.encode),
      nextPageToken: value.nextPageToken,
    };
  },
  decode(value) {
    return {
      namespaces: value.namespaces.map(Namespace.decode),
      nextPageToken: value.nextPageToken,
    };
  },
};

export type ListNamespacesResponse = CodecType<typeof ListNamespacesResponse>;

export const DeleteNamespaceRequest: Codec<
  {
    /**
     * The namespace name.
     *
     * Format: tenants/{tenant}/namespaces/{namespace}
     */
    name: string;
  },
  proto.DeleteNamespaceRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.DeleteNamespaceRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type DeleteNamespaceRequest = CodecType<typeof DeleteNamespaceRequest>;

export const Namespace: Codec<
  {
    /**
     * The namespace name.
     *
     * Format: tenants/{tenant}/namespaces/{namespace}
     */
    name: string;
    /** The size at which the current segment is flushed to object storage. */
    flushSizeBytes: bigint;
    /** The maximum interval at which the current segment is flushed to object storage (in milliseconds). */
    flushIntervalMillis: bigint;
    /** The object store used by this namespace. */
    objectStore: string;
    /** The data lake used by this namespace. */
    dataLake: string;
  },
  proto.Namespace
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.Namespace",
      name: value.name,
      flushSizeBytes: value.flushSizeBytes,
      flushIntervalMillis: value.flushIntervalMillis,
      objectStore: value.objectStore,
      dataLake: value.dataLake,
    };
  },
  decode(value) {
    return {
      name: value.name,
      flushSizeBytes: value.flushSizeBytes,
      flushIntervalMillis: value.flushIntervalMillis,
      objectStore: value.objectStore,
      dataLake: value.dataLake,
    };
  },
};

export type Namespace = CodecType<typeof Namespace>;
