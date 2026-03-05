import { Schema, SchemaTransformation } from "effect";

//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const TenantProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.Tenant"),
  name: Schema.String,
});

type TenantProto = typeof TenantProto.Type;

const CreateTenantRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.CreateTenantRequest"),
  tenantId: Schema.String,
  tenant: Schema.Union([TenantProto, Schema.Undefined]),
});

type CreateTenantRequestProto = typeof CreateTenantRequestProto.Type;

const GetTenantRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetTenantRequest"),
  name: Schema.String,
});

type GetTenantRequestProto = typeof GetTenantRequestProto.Type;

const ListTenantsRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListTenantsRequest"),
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListTenantsRequestProto = typeof ListTenantsRequestProto.Type;

const ListTenantsResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListTenantsResponse"),
  tenants: Schema.Array(TenantProto),
  nextPageToken: Schema.String,
});

type ListTenantsResponseProto = typeof ListTenantsResponseProto.Type;

const DeleteTenantRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteTenantRequest"),
  name: Schema.String,
});

type DeleteTenantRequestProto = typeof DeleteTenantRequestProto.Type;

//    █████████   ███████████  ███████████
//   ███░░░░░███ ░░███░░░░░███░░███░░░░░███
//  ░███    ░███  ░███    ░███ ░███    ░███
//  ░███████████  ░██████████  ░██████████
//  ░███░░░░░███  ░███░░░░░░   ░███░░░░░░
//  ░███    ░███  ░███         ░███
//  █████   █████ █████        █████
// ░░░░░   ░░░░░ ░░░░░        ░░░░░

const TenantApp = Schema.Struct({
  /** The tenant name. Format: tenants/{tenant} */
  name: Schema.String,
});

type TenantApp = typeof TenantApp.Type;

const CreateTenantRequestApp = Schema.Struct({
  /** The tenant id. */
  tenantId: Schema.String,
});

type CreateTenantRequestApp = typeof CreateTenantRequestApp.Type;

const GetTenantRequestApp = Schema.Struct({
  /** The tenant name. Format: tenants/{tenant} */
  name: Schema.String,
});

type GetTenantRequestApp = typeof GetTenantRequestApp.Type;

const ListTenantsRequestApp = Schema.Struct({
  /** The number of tenants to return. Default: 100, Maximum: 1000. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

type ListTenantsRequestApp = typeof ListTenantsRequestApp.Type;

const ListTenantsResponseApp = Schema.Struct({
  /** The tenants. */
  tenants: Schema.Array(TenantApp),
  /** The continuation token. */
  nextPageToken: Schema.String,
});

type ListTenantsResponseApp = typeof ListTenantsResponseApp.Type;

const DeleteTenantRequestApp = Schema.Struct({
  /** The tenant name. Format: tenants/{tenant} */
  name: Schema.String,
});

type DeleteTenantRequestApp = typeof DeleteTenantRequestApp.Type;

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const Tenant = TenantProto.pipe(
  Schema.decodeTo(
    TenantApp,
    SchemaTransformation.transform({
      decode: (proto): TenantApp => ({ name: proto.name }),
      encode: (app): TenantProto => ({
        $type: "wings.v1.cluster_metadata.Tenant" as const,
        name: app.name,
      }),
    }),
  ),
);

export type Tenant = typeof Tenant.Type;

export const CreateTenantRequest = CreateTenantRequestProto.pipe(
  Schema.decodeTo(
    CreateTenantRequestApp,
    SchemaTransformation.transform({
      decode: (proto): CreateTenantRequestApp => ({ tenantId: proto.tenantId }),
      encode: (app): CreateTenantRequestProto => ({
        $type: "wings.v1.cluster_metadata.CreateTenantRequest" as const,
        tenantId: app.tenantId,
        tenant: {
          $type: "wings.v1.cluster_metadata.Tenant" as const,
          name: `tenants/${app.tenantId}`,
        },
      }),
    }),
  ),
);

export type CreateTenantRequest = typeof CreateTenantRequest.Type;

export const GetTenantRequest = GetTenantRequestProto.pipe(
  Schema.decodeTo(
    GetTenantRequestApp,
    SchemaTransformation.transform({
      decode: (proto): GetTenantRequestApp => ({ name: proto.name }),
      encode: (app): GetTenantRequestProto => ({
        $type: "wings.v1.cluster_metadata.GetTenantRequest" as const,
        name: app.name,
      }),
    }),
  ),
);

export type GetTenantRequest = typeof GetTenantRequest.Type;

export const ListTenantsRequest = ListTenantsRequestProto.pipe(
  Schema.decodeTo(
    ListTenantsRequestApp,
    SchemaTransformation.transform({
      decode: (proto): ListTenantsRequestApp => ({
        pageSize: proto.pageSize,
        pageToken: proto.pageToken,
      }),
      encode: (app): ListTenantsRequestProto => ({
        $type: "wings.v1.cluster_metadata.ListTenantsRequest" as const,
        pageSize: app.pageSize,
        pageToken: app.pageToken,
      }),
    }),
  ),
);

export type ListTenantsRequest = typeof ListTenantsRequest.Type;

export const ListTenantsResponse = ListTenantsResponseProto.pipe(
  Schema.decodeTo(
    ListTenantsResponseApp,
    SchemaTransformation.transform({
      decode: (proto): ListTenantsResponseApp => ({
        tenants: proto.tenants.map((t) => ({
          name: t.name,
        })),
        nextPageToken: proto.nextPageToken,
      }),
      encode: (app): ListTenantsResponseProto => ({
        $type: "wings.v1.cluster_metadata.ListTenantsResponse" as const,
        tenants: app.tenants.map((t) => ({
          $type: "wings.v1.cluster_metadata.Tenant" as const,
          name: t.name,
        })),
        nextPageToken: app.nextPageToken,
      }),
    }),
  ),
);

export type ListTenantsResponse = typeof ListTenantsResponse.Type;

export const DeleteTenantRequest = DeleteTenantRequestProto.pipe(
  Schema.decodeTo(
    DeleteTenantRequestApp,
    SchemaTransformation.transform({
      decode: (proto): DeleteTenantRequestApp => ({ name: proto.name }),
      encode: (app): DeleteTenantRequestProto => ({
        $type: "wings.v1.cluster_metadata.DeleteTenantRequest" as const,
        name: app.name,
      }),
    }),
  ),
);

export type DeleteTenantRequest = typeof DeleteTenantRequest.Type;

//    █████████     ███████    ██████████   ██████████   █████████
//   ███░░░░░███  ███░░░░░███ ░░███░░░░███ ░░███░░░░░█  ███░░░░░███
//  ███     ░░░  ███     ░░███ ░███   ░░███ ░███  █ ░  ███     ░░░
// ░███         ░███      ░███ ░███    ░███ ░██████   ░███
// ░███         ░███      ░███ ░███    ░███ ░███░░█   ░███
// ░░███     ███░░███     ███  ░███    ███  ░███ ░   █░░███     ███
//  ░░█████████  ░░░███████░   ██████████   ██████████ ░░█████████
//   ░░░░░░░░░     ░░░░░░░    ░░░░░░░░░░   ░░░░░░░░░░   ░░░░░░░░░

/**
 * Codec for proto <-> app transformations using Schema.encodeSync/decodeSync.
 */
export const Codec = {
  Tenant: {
    toProto: Schema.encodeSync(Tenant),
    fromProto: Schema.decodeSync(Tenant),
  },

  CreateTenantRequest: {
    toProto: Schema.encodeSync(CreateTenantRequest),
    fromProto: Schema.decodeSync(CreateTenantRequest),
  },

  GetTenantRequest: {
    toProto: Schema.encodeSync(GetTenantRequest),
    fromProto: Schema.decodeSync(GetTenantRequest),
  },

  ListTenantsRequest: {
    toProto: Schema.encodeSync(ListTenantsRequest),
    fromProto: Schema.decodeSync(ListTenantsRequest),
  },

  ListTenantsResponse: {
    toProto: Schema.encodeSync(ListTenantsResponse),
    fromProto: Schema.decodeSync(ListTenantsResponse),
  },

  DeleteTenantRequest: {
    toProto: Schema.encodeSync(DeleteTenantRequest),
    fromProto: Schema.decodeSync(DeleteTenantRequest),
  },
} as const;
