import { Schema, SchemaTransformation } from "effect";

import { WingsDecodeError } from "../errors";
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
  flushSizeBytes: Schema.BigInt,
  flushIntervalMillis: Schema.BigInt,
  objectStore: Schema.String,
  dataLake: Schema.String,
});

type NamespaceProto = typeof NamespaceProto.Type;

const CreateNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.CreateNamespaceRequest"),
  parent: Schema.String,
  namespaceId: Schema.String,
  namespace: Schema.Union([NamespaceProto, Schema.Undefined]),
});

type CreateNamespaceRequestProto = typeof CreateNamespaceRequestProto.Type;

const GetNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetNamespaceRequest"),
  name: Schema.String,
});

type GetNamespaceRequestProto = typeof GetNamespaceRequestProto.Type;

const ListNamespacesRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListNamespacesRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListNamespacesRequestProto = typeof ListNamespacesRequestProto.Type;

const ListNamespacesResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListNamespacesResponse"),
  namespaces: Schema.Array(NamespaceProto),
  nextPageToken: Schema.String,
});

type ListNamespacesResponseProto = typeof ListNamespacesResponseProto.Type;

const DeleteNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteNamespaceRequest"),
  name: Schema.String,
});

type DeleteNamespaceRequestProto = typeof DeleteNamespaceRequestProto.Type;

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
  flushSizeBytes: Schema.BigInt,
  /** The maximum interval at which the current segment is flushed (in milliseconds). */
  flushIntervalMillis: Schema.BigInt,
  /** The object store used by this namespace. */
  objectStore: Schema.String,
  /** The data lake used by this namespace. */
  dataLake: Schema.String,
});

type NamespaceApp = typeof NamespaceApp.Type;

const CreateNamespaceRequestApp = Schema.Struct({
  /** The tenant that owns the namespace. Format: tenants/{tenant} */
  parent: Schema.String,
  /** The namespace id. */
  namespaceId: Schema.String,
  /** The size at which the current segment is flushed to object storage. */
  flushSizeBytes: Schema.BigInt,
  /** The maximum interval at which the current segment is flushed (in milliseconds). */
  flushIntervalMillis: Schema.BigInt,
  /** The object store used by this namespace. */
  objectStore: Schema.String,
  /** The data lake used by this namespace. */
  dataLake: Schema.String,
});

type CreateNamespaceRequestApp = typeof CreateNamespaceRequestApp.Type;

const GetNamespaceRequestApp = Schema.Struct({
  /** The namespace name. Format: tenants/{tenant}/namespaces/{namespace} */
  name: Schema.String,
});

type GetNamespaceRequestApp = typeof GetNamespaceRequestApp.Type;

const ListNamespacesRequestApp = Schema.Struct({
  /** The parent tenant. Format: tenants/{tenant} */
  parent: Schema.String,
  /** The number of namespaces to return. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

type ListNamespacesRequestApp = typeof ListNamespacesRequestApp.Type;

const ListNamespacesResponseApp = Schema.Struct({
  /** The namespaces. */
  namespaces: Schema.Array(NamespaceApp),
  /** The continuation token. */
  nextPageToken: Schema.String,
});

type ListNamespacesResponseApp = typeof ListNamespacesResponseApp.Type;

const DeleteNamespaceRequestApp = Schema.Struct({
  /** The namespace name. Format: tenants/{tenant}/namespaces/{namespace} */
  name: Schema.String,
});

type DeleteNamespaceRequestApp = typeof DeleteNamespaceRequestApp.Type;

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const Namespace = NamespaceProto.pipe(
  Schema.decodeTo(
    NamespaceApp,
    SchemaTransformation.transform({
      decode: (proto): NamespaceApp => ({
        name: proto.name,
        flushSizeBytes: proto.flushSizeBytes,
        flushIntervalMillis: proto.flushIntervalMillis,
        objectStore: proto.objectStore,
        dataLake: proto.dataLake,
      }),
      encode: (app): NamespaceProto => ({
        $type: "wings.v1.cluster_metadata.Namespace" as const,
        name: app.name,
        flushSizeBytes: app.flushSizeBytes,
        flushIntervalMillis: app.flushIntervalMillis,
        objectStore: app.objectStore,
        dataLake: app.dataLake,
      }),
    }),
  ),
);

export type Namespace = typeof Namespace.Type;

export const CreateNamespaceRequest = CreateNamespaceRequestProto.pipe(
  Schema.decodeTo(
    CreateNamespaceRequestApp,
    SchemaTransformation.transform({
      decode: (proto): CreateNamespaceRequestApp => {
        if (proto.namespace === undefined) {
          throw new WingsDecodeError("Namespace metadata is undefined");
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
      encode: (app): CreateNamespaceRequestProto => ({
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
    }),
  ),
);

export type CreateNamespaceRequest = typeof CreateNamespaceRequest.Type;

export const GetNamespaceRequest = GetNamespaceRequestProto.pipe(
  Schema.decodeTo(
    GetNamespaceRequestApp,
    SchemaTransformation.transform({
      decode: (proto): GetNamespaceRequestApp => ({ name: proto.name }),
      encode: (app): GetNamespaceRequestProto => ({
        $type: "wings.v1.cluster_metadata.GetNamespaceRequest" as const,
        name: app.name,
      }),
    }),
  ),
);

export type GetNamespaceRequest = typeof GetNamespaceRequest.Type;

export const ListNamespacesRequest = ListNamespacesRequestProto.pipe(
  Schema.decodeTo(
    ListNamespacesRequestApp,
    SchemaTransformation.transform({
      decode: (proto): ListNamespacesRequestApp => ({
        parent: proto.parent,
        pageSize: proto.pageSize,
        pageToken: proto.pageToken,
      }),
      encode: (app): ListNamespacesRequestProto => ({
        $type: "wings.v1.cluster_metadata.ListNamespacesRequest" as const,
        parent: app.parent,
        pageSize: app.pageSize,
        pageToken: app.pageToken,
      }),
    }),
  ),
);

export type ListNamespacesRequest = typeof ListNamespacesRequest.Type;

export const ListNamespacesResponse = ListNamespacesResponseProto.pipe(
  Schema.decodeTo(
    ListNamespacesResponseApp,
    SchemaTransformation.transform({
      decode: (proto): ListNamespacesResponseApp => ({
        namespaces: proto.namespaces.map((ns) => ({
          name: ns.name,
          flushSizeBytes: ns.flushSizeBytes,
          flushIntervalMillis: ns.flushIntervalMillis,
          objectStore: ns.objectStore,
          dataLake: ns.dataLake,
        })),
        nextPageToken: proto.nextPageToken,
      }),
      encode: (app): ListNamespacesResponseProto => ({
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
    }),
  ),
);

export type ListNamespacesResponse = typeof ListNamespacesResponse.Type;

export const DeleteNamespaceRequest = DeleteNamespaceRequestProto.pipe(
  Schema.decodeTo(
    DeleteNamespaceRequestApp,
    SchemaTransformation.transform({
      decode: (proto): DeleteNamespaceRequestApp => ({ name: proto.name }),
      encode: (app): DeleteNamespaceRequestProto => ({
        $type: "wings.v1.cluster_metadata.DeleteNamespaceRequest" as const,
        name: app.name,
      }),
    }),
  ),
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
