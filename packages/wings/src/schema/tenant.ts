import { Schema } from "effect";

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

const CreateTenantRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.CreateTenantRequest"),
  tenantId: Schema.String,
  tenant: Schema.Union(TenantProto, Schema.Undefined),
});

const GetTenantRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetTenantRequest"),
  name: Schema.String,
});

const ListTenantsRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListTenantsRequest"),
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

const ListTenantsResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListTenantsResponse"),
  tenants: Schema.Array(TenantProto),
  nextPageToken: Schema.String,
});

const DeleteTenantRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteTenantRequest"),
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

const TenantApp = Schema.Struct({
  /** The tenant name. Format: tenants/{tenant} */
  name: Schema.String,
});

const CreateTenantRequestApp = Schema.Struct({
  /** The tenant id. */
  tenantId: Schema.String,
});

const GetTenantRequestApp = Schema.Struct({
  /** The tenant name. Format: tenants/{tenant} */
  name: Schema.String,
});

const ListTenantsRequestApp = Schema.Struct({
  /** The number of tenants to return. Default: 100, Maximum: 1000. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

const DeleteTenantRequestApp = Schema.Struct({
  /** The tenant name. Format: tenants/{tenant} */
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

export const Tenant = Schema.transform(TenantProto, TenantApp, {
  strict: true,
  decode: (proto) => ({ name: proto.name }),
  encode: (app) => ({
    $type: "wings.v1.cluster_metadata.Tenant" as const,
    name: app.name,
  }),
});

export type Tenant = typeof Tenant.Type;

export const CreateTenantRequest = Schema.transform(
  CreateTenantRequestProto,
  CreateTenantRequestApp,
  {
    strict: true,
    decode: (proto) => ({ tenantId: proto.tenantId }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.CreateTenantRequest" as const,
      tenantId: app.tenantId,
      tenant: {
        $type: "wings.v1.cluster_metadata.Tenant" as const,
        name: `tenants/${app.tenantId}`,
      },
    }),
  },
);

export type CreateTenantRequest = typeof CreateTenantRequest.Type;

export const GetTenantRequest = Schema.transform(
  GetTenantRequestProto,
  GetTenantRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.GetTenantRequest" as const,
      name: app.name,
    }),
  },
);

export type GetTenantRequest = typeof GetTenantRequest.Type;

export const ListTenantsRequest = Schema.transform(
  ListTenantsRequestProto,
  ListTenantsRequestApp,
  {
    strict: true,
    decode: (proto) => ({
      pageSize: proto.pageSize,
      pageToken: proto.pageToken,
    }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.ListTenantsRequest" as const,
      pageSize: app.pageSize,
      pageToken: app.pageToken,
    }),
  },
);

export type ListTenantsRequest = typeof ListTenantsRequest.Type;

export const ListTenantsResponse = Schema.transform(
  ListTenantsResponseProto,
  Schema.Struct({
    /** The tenants. */
    tenants: Schema.Array(TenantApp),
    /** The continuation token. */
    nextPageToken: Schema.String,
  }),
  {
    strict: true,
    decode: (proto) => ({
      tenants: proto.tenants.map((t) => ({ name: t.name })),
      nextPageToken: proto.nextPageToken,
    }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.ListTenantsResponse" as const,
      tenants: app.tenants.map((t) => ({
        $type: "wings.v1.cluster_metadata.Tenant" as const,
        name: t.name,
      })),
      nextPageToken: app.nextPageToken,
    }),
  },
);

export type ListTenantsResponse = typeof ListTenantsResponse.Type;

export const DeleteTenantRequest = Schema.transform(
  DeleteTenantRequestProto,
  DeleteTenantRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.DeleteTenantRequest" as const,
      name: app.name,
    }),
  },
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
