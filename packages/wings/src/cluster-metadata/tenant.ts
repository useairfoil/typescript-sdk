import type { Codec, CodecType } from "../lib/codec";
import type * as proto from "../proto/cluster_metadata";

export const CreateTenantRequest: Codec<
  {
    /** The tenant id. */
    tenantId: string;
  },
  proto.CreateTenantRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.CreateTenantRequest",
      tenantId: value.tenantId,
      tenant: Tenant.encode({
        name: value.tenantId,
      }),
    };
  },
  decode(value) {
    return {
      tenantId: value.tenantId,
    };
  },
};

export type CreateTenantRequest = CodecType<typeof CreateTenantRequest>;

export const GetTenantRequest: Codec<
  {
    /**
     * The tenant name.
     *
     * Format: tenants/{tenant}
     */
    name: string;
  },
  proto.GetTenantRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.GetTenantRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type GetTenantRequest = CodecType<typeof GetTenantRequest>;

export const ListTenantsRequest: Codec<
  {
    /**
     * The number of tenants to return.
     *
     * Default: 100
     * Maximum: 1000.
     */
    pageSize?: number;
    /** The continuation token. */
    pageToken?: string;
  },
  proto.ListTenantsRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListTenantsRequest",
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    };
  },
  decode(value) {
    return {
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    };
  },
};

export type ListTenantsRequest = CodecType<typeof ListTenantsRequest>;

export const ListTenantsResponse: Codec<
  {
    /** The tenants. */
    tenants: Tenant[];
    /** The continuation token. */
    nextPageToken: string;
  },
  proto.ListTenantsResponse
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListTenantsResponse",
      tenants: value.tenants.map(Tenant.encode),
      nextPageToken: value.nextPageToken,
    };
  },
  decode(value) {
    return {
      tenants: value.tenants.map(Tenant.decode),
      nextPageToken: value.nextPageToken,
    };
  },
};

export type ListTenantsResponse = CodecType<typeof ListTenantsResponse>;

export const DeleteTenantRequest: Codec<
  {
    /**
     * The tenant name.
     *
     * Format: tenants/{tenant}
     */
    name: string;
  },
  proto.DeleteTenantRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.DeleteTenantRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type DeleteTenantRequest = CodecType<typeof DeleteTenantRequest>;

export const Tenant: Codec<
  {
    /**
     * The tenant name.
     *
     * Format: tenants/{tenant}
     */
    name: string;
  },
  proto.Tenant
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.Tenant",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type Tenant = CodecType<typeof Tenant>;
