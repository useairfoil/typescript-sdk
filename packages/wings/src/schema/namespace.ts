import { Schema } from "effect";

//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const NamespaceProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.Namespace"),
  name: Schema.String,
  flushSizeBytes: Schema.BigIntFromSelf,
  flushIntervalMillis: Schema.BigIntFromSelf,
  objectStore: Schema.String,
  dataLake: Schema.String,
});

const CreateNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.CreateNamespaceRequest"),
  parent: Schema.String,
  namespaceId: Schema.String,
  namespace: Schema.Union(NamespaceProto, Schema.Undefined),
});

const GetNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetNamespaceRequest"),
  name: Schema.String,
});

const ListNamespacesRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListNamespacesRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

const ListNamespacesResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListNamespacesResponse"),
  namespaces: Schema.Array(NamespaceProto),
  nextPageToken: Schema.String,
});

const DeleteNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteNamespaceRequest"),
  name: Schema.String,
});

//    █████████   ███████████  ███████████
//   ███░░░░░███ ░░███░░░░░███░░███░░░░░███
//  ░███    ░███  ░███    ░███ ░███    ░███
//  ░███████████  ░██████████  ░██████████
//  ░███░░░░░███  ░███░░░░░░   ░███░░░░░░
//  ░███    ░███  ░███         ░███
//  █████   █████ █████        █████
// ░░░░░   ░░░░░ ░░░░░        ░░░░░

const NamespaceApp = Schema.Struct({
  /** The namespace name. Format: tenants/{tenant}/namespaces/{namespace} */
  name: Schema.String,
  /** The size at which the current segment is flushed to object storage. */
  flushSizeBytes: Schema.BigIntFromSelf,
  /** The maximum interval at which the current segment is flushed (in milliseconds). */
  flushIntervalMillis: Schema.BigIntFromSelf,
  /** The object store used by this namespace. */
  objectStore: Schema.String,
  /** The data lake used by this namespace. */
  dataLake: Schema.String,
});

const CreateNamespaceRequestApp = Schema.Struct({
  /** The tenant that owns the namespace. Format: tenants/{tenant} */
  parent: Schema.String,
  /** The namespace id. */
  namespaceId: Schema.String,
  /** The size at which the current segment is flushed to object storage. */
  flushSizeBytes: Schema.BigIntFromSelf,
  /** The maximum interval at which the current segment is flushed (in milliseconds). */
  flushIntervalMillis: Schema.BigIntFromSelf,
  /** The object store used by this namespace. */
  objectStore: Schema.String,
  /** The data lake used by this namespace. */
  dataLake: Schema.String,
});

const GetNamespaceRequestApp = Schema.Struct({
  /** The namespace name. Format: tenants/{tenant}/namespaces/{namespace} */
  name: Schema.String,
});

const ListNamespacesRequestApp = Schema.Struct({
  /** The parent tenant. Format: tenants/{tenant} */
  parent: Schema.String,
  /** The number of namespaces to return. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

const DeleteNamespaceRequestApp = Schema.Struct({
  /** The namespace name. Format: tenants/{tenant}/namespaces/{namespace} */
  name: Schema.String,
});

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const Namespace = Schema.transform(NamespaceProto, NamespaceApp, {
  strict: true,
  decode: (proto) => ({
    name: proto.name,
    flushSizeBytes: proto.flushSizeBytes,
    flushIntervalMillis: proto.flushIntervalMillis,
    objectStore: proto.objectStore,
    dataLake: proto.dataLake,
  }),
  encode: (app) => ({
    $type: "wings.v1.cluster_metadata.Namespace" as const,
    name: app.name,
    flushSizeBytes: app.flushSizeBytes,
    flushIntervalMillis: app.flushIntervalMillis,
    objectStore: app.objectStore,
    dataLake: app.dataLake,
  }),
});

export type Namespace = typeof Namespace.Type;

export const CreateNamespaceRequest = Schema.transform(
  CreateNamespaceRequestProto,
  CreateNamespaceRequestApp,
  {
    strict: true,
    decode: (proto) => {
      if (proto.namespace === undefined) {
        throw new Error("Namespace metadata is undefined");
      }
      return {
        parent: proto.parent,
        namespaceId: proto.namespaceId,
        flushSizeBytes: proto.namespace.flushSizeBytes,
        flushIntervalMillis: proto.namespace.flushIntervalMillis,
        objectStore: proto.namespace.objectStore,
        dataLake: proto.namespace.dataLake,
      };
    },
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.CreateNamespaceRequest" as const,
      parent: app.parent,
      namespaceId: app.namespaceId,
      namespace: {
        $type: "wings.v1.cluster_metadata.Namespace" as const,
        name: `${app.parent}/namespaces/${app.namespaceId}`,
        flushSizeBytes: app.flushSizeBytes,
        flushIntervalMillis: app.flushIntervalMillis,
        objectStore: app.objectStore,
        dataLake: app.dataLake,
      },
    }),
  },
);

export type CreateNamespaceRequest = typeof CreateNamespaceRequest.Type;

export const GetNamespaceRequest = Schema.transform(
  GetNamespaceRequestProto,
  GetNamespaceRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.GetNamespaceRequest" as const,
      name: app.name,
    }),
  },
);

export type GetNamespaceRequest = typeof GetNamespaceRequest.Type;

export const ListNamespacesRequest = Schema.transform(
  ListNamespacesRequestProto,
  ListNamespacesRequestApp,
  {
    strict: true,
    decode: (proto) => ({
      parent: proto.parent,
      pageSize: proto.pageSize,
      pageToken: proto.pageToken,
    }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.ListNamespacesRequest" as const,
      parent: app.parent,
      pageSize: app.pageSize,
      pageToken: app.pageToken,
    }),
  },
);

export type ListNamespacesRequest = typeof ListNamespacesRequest.Type;

export const ListNamespacesResponse = Schema.transform(
  ListNamespacesResponseProto,
  Schema.Struct({
    /** The namespaces. */
    namespaces: Schema.Array(NamespaceApp),
    /** The continuation token. */
    nextPageToken: Schema.String,
  }),
  {
    strict: true,
    decode: (proto) => ({
      namespaces: proto.namespaces.map((ns) => ({
        name: ns.name,
        flushSizeBytes: ns.flushSizeBytes,
        flushIntervalMillis: ns.flushIntervalMillis,
        objectStore: ns.objectStore,
        dataLake: ns.dataLake,
      })),
      nextPageToken: proto.nextPageToken,
    }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.ListNamespacesResponse" as const,
      namespaces: app.namespaces.map((ns) => ({
        $type: "wings.v1.cluster_metadata.Namespace" as const,
        name: ns.name,
        flushSizeBytes: ns.flushSizeBytes,
        flushIntervalMillis: ns.flushIntervalMillis,
        objectStore: ns.objectStore,
        dataLake: ns.dataLake,
      })),
      nextPageToken: app.nextPageToken,
    }),
  },
);

export type ListNamespacesResponse = typeof ListNamespacesResponse.Type;

export const DeleteNamespaceRequest = Schema.transform(
  DeleteNamespaceRequestProto,
  DeleteNamespaceRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.DeleteNamespaceRequest" as const,
      name: app.name,
    }),
  },
);

export type DeleteNamespaceRequest = typeof DeleteNamespaceRequest.Type;

//    █████████     ███████    ██████████   ██████████   █████████
//   ███░░░░░███  ███░░░░░███ ░░███░░░░███ ░░███░░░░░█  ███░░░░░███
//  ███     ░░░  ███     ░░███ ░███   ░░███ ░███  █ ░  ███     ░░░
// ░███         ░███      ░███ ░███    ░███ ░██████   ░███
// ░███         ░███      ░███ ░███    ░███ ░███░░█   ░███
// ░░███     ███░░███     ███  ░███    ███  ░███ ░   █░░███     ███
//  ░░█████████  ░░░███████░   ██████████   ██████████ ░░█████████
//   ░░░░░░░░░     ░░░░░░░    ░░░░░░░░░░   ░░░░░░░░░░   ░░░░░░░░░

export const Codec = {
  Namespace: {
    toProto: Schema.encodeSync(Namespace),
    fromProto: Schema.decodeSync(Namespace),
  },

  CreateNamespaceRequest: {
    toProto: Schema.encodeSync(CreateNamespaceRequest),
    fromProto: Schema.decodeSync(CreateNamespaceRequest),
  },

  GetNamespaceRequest: {
    toProto: Schema.encodeSync(GetNamespaceRequest),
    fromProto: Schema.decodeSync(GetNamespaceRequest),
  },

  ListNamespacesRequest: {
    toProto: Schema.encodeSync(ListNamespacesRequest),
    fromProto: Schema.decodeSync(ListNamespacesRequest),
  },

  ListNamespacesResponse: {
    toProto: Schema.encodeSync(ListNamespacesResponse),
    fromProto: Schema.decodeSync(ListNamespacesResponse),
  },

  DeleteNamespaceRequest: {
    toProto: Schema.encodeSync(DeleteNamespaceRequest),
    fromProto: Schema.decodeSync(DeleteNamespaceRequest),
  },
} as const;
