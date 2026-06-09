import { Schema, SchemaTransformation } from "effect";

import { WingsDecodeError } from "../errors";
import { Lake, LakeApp, LakeProto } from "./data-lake";
import { ObjectStore, ObjectStoreApp, ObjectStoreProto } from "./object-store";

//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const NamespaceProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.Namespace"),
  name: Schema.String,
  objectStore: Schema.optional(ObjectStoreProto),
  lake: Schema.optional(LakeProto),
});

type NamespaceProto = typeof NamespaceProto.Type;

const CreateNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.CreateNamespaceRequest"),
  namespaceId: Schema.String,
  namespace: Schema.optional(NamespaceProto),
});

type CreateNamespaceRequestProto = typeof CreateNamespaceRequestProto.Type;

const UpdateNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.UpdateNamespaceRequest"),
  namespace: Schema.optional(NamespaceProto),
  updateMask: Schema.optional(Schema.Array(Schema.String)),
});

type UpdateNamespaceRequestProto = typeof UpdateNamespaceRequestProto.Type;

const GetNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.GetNamespaceRequest"),
  name: Schema.String,
});

type GetNamespaceRequestProto = typeof GetNamespaceRequestProto.Type;

const ListNamespacesRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.ListNamespacesRequest"),
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListNamespacesRequestProto = typeof ListNamespacesRequestProto.Type;

const ListNamespacesResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.ListNamespacesResponse"),
  namespaces: Schema.Array(NamespaceProto),
  nextPageToken: Schema.optional(Schema.String),
});

type ListNamespacesResponseProto = typeof ListNamespacesResponseProto.Type;

const DeleteNamespaceRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.DeleteNamespaceRequest"),
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
  /** The namespace name. Format: namespaces/{namespace} */
  name: Schema.String,
  /** The object store configuration. (TODO: Temporairly optional) */
  objectStore: Schema.optional(ObjectStoreApp),
  /** The lake configuration. (TODO: Temporairly optional) */
  lake: Schema.optional(LakeApp),
});

type NamespaceApp = typeof NamespaceApp.Type;

// CreateNamespaceRequest flattens objectStore/lake to the top level (no nested namespace field).
const CreateNamespaceRequestApp = Schema.Struct({
  /** The namespace id. */
  namespaceId: Schema.String,
  /** The object store configuration. */
  objectStore: ObjectStoreApp,
  /** The lake configuration. */
  lake: LakeApp,
});

type CreateNamespaceRequestApp = typeof CreateNamespaceRequestApp.Type;

const GetNamespaceRequestApp = Schema.Struct({
  /** The namespace name. Format: namespaces/{namespace} */
  name: Schema.String,
});

type GetNamespaceRequestApp = typeof GetNamespaceRequestApp.Type;

const ListNamespacesRequestApp = Schema.Struct({
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
  nextPageToken: Schema.optional(Schema.String),
});

type ListNamespacesResponseApp = typeof ListNamespacesResponseApp.Type;

const DeleteNamespaceRequestApp = Schema.Struct({
  /** The namespace name. Format: namespaces/{namespace} */
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
        objectStore: proto.objectStore
          ? Schema.decodeSync(ObjectStore)(proto.objectStore)
          : undefined,
        lake: proto.lake ? Schema.decodeSync(Lake)(proto.lake) : undefined,
      }),
      encode: (app): NamespaceProto => ({
        $type: "wings.cluster.Namespace" as const,
        name: app.name,
        objectStore: app.objectStore ? Schema.encodeSync(ObjectStore)(app.objectStore) : undefined,
        lake: app.lake ? Schema.encodeSync(Lake)(app.lake) : undefined,
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
        if (!proto.namespace.objectStore) {
          throw new WingsDecodeError("Namespace objectStore is undefined");
        }
        if (!proto.namespace.lake) {
          throw new WingsDecodeError("Namespace lake is undefined");
        }
        return {
          namespaceId: proto.namespaceId,
          objectStore: Schema.decodeSync(ObjectStore)(proto.namespace.objectStore),
          lake: Schema.decodeSync(Lake)(proto.namespace.lake),
        };
      },
      encode: (app): CreateNamespaceRequestProto => ({
        $type: "wings.cluster.CreateNamespaceRequest" as const,
        namespaceId: app.namespaceId,
        namespace: {
          $type: "wings.cluster.Namespace" as const,
          name: `namespaces/${app.namespaceId}`,
          objectStore: Schema.encodeSync(ObjectStore)(app.objectStore),
          lake: Schema.encodeSync(Lake)(app.lake),
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
        $type: "wings.cluster.GetNamespaceRequest" as const,
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
        pageSize: proto.pageSize,
        pageToken: proto.pageToken,
      }),
      encode: (app): ListNamespacesRequestProto => ({
        $type: "wings.cluster.ListNamespacesRequest" as const,
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
        namespaces: proto.namespaces.map((n) => Schema.decodeSync(Namespace)(n)),
        nextPageToken: proto.nextPageToken,
      }),
      encode: (app): ListNamespacesResponseProto => ({
        $type: "wings.cluster.ListNamespacesResponse" as const,
        namespaces: app.namespaces.map((n) => Schema.encodeSync(Namespace)(n)),
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
        $type: "wings.cluster.DeleteNamespaceRequest" as const,
        name: app.name,
      }),
    }),
  ),
);

export type DeleteNamespaceRequest = typeof DeleteNamespaceRequest.Type;

const UpdateNamespaceRequestApp = Schema.Struct({
  /** The namespace to update. Includes its name to identify it. */
  namespace: NamespaceApp,
  /** The list of fields to update. */
  updateMask: Schema.optional(Schema.Array(Schema.String)),
});

type UpdateNamespaceRequestApp = typeof UpdateNamespaceRequestApp.Type;

export const UpdateNamespaceRequest = UpdateNamespaceRequestProto.pipe(
  Schema.decodeTo(
    UpdateNamespaceRequestApp,
    SchemaTransformation.transform({
      decode: (proto): UpdateNamespaceRequestApp => {
        if (!proto.namespace) {
          throw new WingsDecodeError("Namespace metadata is undefined");
        }
        return {
          namespace: Schema.decodeSync(Namespace)(proto.namespace),
          updateMask: proto.updateMask,
        };
      },
      encode: (app): UpdateNamespaceRequestProto => ({
        $type: "wings.cluster.UpdateNamespaceRequest" as const,
        namespace: Schema.encodeSync(Namespace)(app.namespace),
        updateMask: app.updateMask,
      }),
    }),
  ),
);

export type UpdateNamespaceRequest = typeof UpdateNamespaceRequest.Type;

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

  UpdateNamespaceRequest: {
    toProto: Schema.encodeSync(UpdateNamespaceRequest),
    fromProto: Schema.decodeSync(UpdateNamespaceRequest),
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
