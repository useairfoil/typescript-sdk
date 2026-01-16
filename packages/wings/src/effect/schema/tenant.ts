import { Schema } from "effect";
import type * as proto from "../../proto/cluster_metadata";

export const CreateTenantRequest = Schema.Struct({
  /** The tenant id. */
  tenantId: Schema.String,
});

export type CreateTenantRequest = typeof CreateTenantRequest.Type;

export const GetTenantRequest = Schema.Struct({
  /**
   * The tenant name.
   *
   * Format: tenants/{tenant}
   */
  name: Schema.String,
});

export type GetTenantRequest = typeof GetTenantRequest.Type;

export const ListTenantsRequest = Schema.Struct({
  /**
   * The number of tenants to return.
   *
   * Default: 100
   * Maximum: 1000.
   */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

export type ListTenantsRequest = typeof ListTenantsRequest.Type;

export const Tenant = Schema.Struct({
  /**
   * The tenant name.
   *
   * Format: tenants/{tenant}
   */
  name: Schema.String,
});

export type Tenant = typeof Tenant.Type;

export const ListTenantsResponse = Schema.Struct({
  /** The tenants. */
  tenants: Schema.Array(Tenant),
  /** The continuation token. */
  nextPageToken: Schema.String,
});

export type ListTenantsResponse = typeof ListTenantsResponse.Type;

export const DeleteTenantRequest = Schema.Struct({
  /**
   * The tenant name.
   *
   * Format: tenants/{tenant}
   */
  name: Schema.String,
});

export type DeleteTenantRequest = typeof DeleteTenantRequest.Type;

export const Codec = {
  CreateTenantRequest: {
    toProto: (value: CreateTenantRequest): proto.CreateTenantRequest => ({
      $type: "wings.v1.cluster_metadata.CreateTenantRequest",
      tenantId: value.tenantId,
      tenant: {
        $type: "wings.v1.cluster_metadata.Tenant",
        name: `tenants/${value.tenantId}`,
      },
    }),
    fromProto: (value: proto.CreateTenantRequest): CreateTenantRequest => ({
      tenantId: value.tenantId,
    }),
  },

  Tenant: {
    toProto: (value: Tenant): proto.Tenant => ({
      $type: "wings.v1.cluster_metadata.Tenant",
      name: value.name,
    }),
    fromProto: (value: proto.Tenant): Tenant => ({
      name: value.name,
    }),
  },

  GetTenantRequest: {
    toProto: (value: GetTenantRequest): proto.GetTenantRequest => ({
      $type: "wings.v1.cluster_metadata.GetTenantRequest",
      name: value.name,
    }),
    fromProto: (value: proto.GetTenantRequest): GetTenantRequest => ({
      name: value.name,
    }),
  },

  ListTenantsRequest: {
    toProto: (value: ListTenantsRequest): proto.ListTenantsRequest => ({
      $type: "wings.v1.cluster_metadata.ListTenantsRequest",
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
    fromProto: (value: proto.ListTenantsRequest): ListTenantsRequest => ({
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
  },

  ListTenantsResponse: {
    toProto: (value: ListTenantsResponse): proto.ListTenantsResponse => ({
      $type: "wings.v1.cluster_metadata.ListTenantsResponse",
      tenants: value.tenants.map(Codec.Tenant.toProto),
      nextPageToken: value.nextPageToken,
    }),
    fromProto: (value: proto.ListTenantsResponse): ListTenantsResponse => ({
      tenants: value.tenants.map(Codec.Tenant.fromProto),
      nextPageToken: value.nextPageToken,
    }),
  },

  DeleteTenantRequest: {
    toProto: (value: DeleteTenantRequest): proto.DeleteTenantRequest => ({
      $type: "wings.v1.cluster_metadata.DeleteTenantRequest",
      name: value.name,
    }),
    fromProto: (value: proto.DeleteTenantRequest): DeleteTenantRequest => ({
      name: value.name,
    }),
  },
} as const;
