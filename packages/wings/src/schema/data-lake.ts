import { Schema } from "effect";
import type * as proto from "../proto/cluster_metadata";
import { tag } from "./helpers";

//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const GetDataLakeRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetDataLakeRequest"),
  name: Schema.String,
});

const ListDataLakesRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListDataLakesRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

const DeleteDataLakeRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteDataLakeRequest"),
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

export const IcebergConfiguration = Schema.Struct({
  _tag: tag("iceberg"),
  iceberg: Schema.Struct({}),
});

export type IcebergConfiguration = typeof IcebergConfiguration.Type;

export const ParquetConfiguration = Schema.Struct({
  _tag: tag("parquet"),
  parquet: Schema.Struct({}),
});

export type ParquetConfiguration = typeof ParquetConfiguration.Type;

export const DataLakeConfig = Schema.Union(
  IcebergConfiguration,
  ParquetConfiguration,
);

export type DataLakeConfig = typeof DataLakeConfig.Type;

export const DataLake = Schema.Struct({
  /** The data lake name. Format: tenants/{tenant}/data-lakes/{data-lake} */
  name: Schema.String,
  /** Data lake configuration. */
  dataLakeConfig: DataLakeConfig,
});

export type DataLake = typeof DataLake.Type;

export const CreateDataLakeRequest = Schema.Struct({
  /** The tenant that owns the data lake. Format: tenants/{tenant} */
  parent: Schema.String,
  /** The data lake id. */
  dataLakeId: Schema.String,
  /** Data lake configuration. */
  dataLakeConfig: DataLakeConfig,
});

export type CreateDataLakeRequest = typeof CreateDataLakeRequest.Type;

const GetDataLakeRequestApp = Schema.Struct({
  /** The data lake name. Format: tenants/{tenant}/data-lakes/{data-lake} */
  name: Schema.String,
});

const ListDataLakesRequestApp = Schema.Struct({
  /** The parent tenant. Format: tenants/{tenant} */
  parent: Schema.String,
  /** The number of data lakes to return. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

export const ListDataLakesResponse = Schema.Struct({
  dataLakes: Schema.Array(DataLake),
  nextPageToken: Schema.String,
});

export type ListDataLakesResponse = typeof ListDataLakesResponse.Type;

const DeleteDataLakeRequestApp = Schema.Struct({
  /** The data lake name. Format: tenants/{tenant}/data-lakes/{data-lake} */
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

export const GetDataLakeRequest = Schema.transform(
  GetDataLakeRequestProto,
  GetDataLakeRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.GetDataLakeRequest" as const,
      name: app.name,
    }),
  },
);

export type GetDataLakeRequest = typeof GetDataLakeRequest.Type;

export const ListDataLakesRequest = Schema.transform(
  ListDataLakesRequestProto,
  ListDataLakesRequestApp,
  {
    strict: true,
    decode: (proto) => ({
      parent: proto.parent,
      pageSize: proto.pageSize,
      pageToken: proto.pageToken,
    }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.ListDataLakesRequest" as const,
      parent: app.parent,
      pageSize: app.pageSize,
      pageToken: app.pageToken,
    }),
  },
);

export type ListDataLakesRequest = typeof ListDataLakesRequest.Type;

export const DeleteDataLakeRequest = Schema.transform(
  DeleteDataLakeRequestProto,
  DeleteDataLakeRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.DeleteDataLakeRequest" as const,
      name: app.name,
    }),
  },
);

export type DeleteDataLakeRequest = typeof DeleteDataLakeRequest.Type;

//    █████████     ███████    ██████████   ██████████   █████████
//   ███░░░░░███  ███░░░░░███ ░░███░░░░███ ░░███░░░░░█  ███░░░░░███
//  ███     ░░░  ███     ░░███ ░███   ░░███ ░███  █ ░  ███     ░░░
// ░███         ░███      ░███ ░███    ░███ ░██████   ░███
// ░███         ░███      ░███ ░███    ░███ ░███░░█   ░███
// ░░███     ███░░███     ███  ░███    ███  ░███ ░   █░░███     ███
//  ░░█████████  ░░░███████░   ██████████   ██████████ ░░█████████
//   ░░░░░░░░░     ░░░░░░░    ░░░░░░░░░░   ░░░░░░░░░░   ░░░░░░░░░

function dataLakeConfigToProto(
  config: DataLakeConfig,
): proto.DataLake["dataLakeConfig"] {
  switch (config._tag) {
    case "iceberg":
      return {
        $case: "iceberg",
        iceberg: { $type: "wings.v1.cluster_metadata.IcebergConfiguration" },
      };
    case "parquet":
      return {
        $case: "parquet",
        parquet: { $type: "wings.v1.cluster_metadata.ParquetConfiguration" },
      };
  }
}

function dataLakeConfigFromProto(
  config: NonNullable<proto.DataLake["dataLakeConfig"]>,
): DataLakeConfig {
  switch (config.$case) {
    case "iceberg":
      return { _tag: "iceberg", iceberg: {} };
    case "parquet":
      return { _tag: "parquet", parquet: {} };
  }
}

export const Codec = {
  DataLake: {
    toProto: (value: DataLake): proto.DataLake => ({
      $type: "wings.v1.cluster_metadata.DataLake",
      name: value.name,
      dataLakeConfig: dataLakeConfigToProto(value.dataLakeConfig),
    }),
    fromProto: (value: proto.DataLake): DataLake => {
      if (!value.dataLakeConfig) {
        throw new Error("DataLake config is undefined");
      }
      return {
        name: value.name,
        dataLakeConfig: dataLakeConfigFromProto(value.dataLakeConfig),
      };
    },
  },

  CreateDataLakeRequest: {
    toProto: (value: CreateDataLakeRequest): proto.CreateDataLakeRequest => ({
      $type: "wings.v1.cluster_metadata.CreateDataLakeRequest",
      parent: value.parent,
      dataLakeId: value.dataLakeId,
      dataLake: {
        $type: "wings.v1.cluster_metadata.DataLake",
        name: `${value.parent}/data-lakes/${value.dataLakeId}`,
        dataLakeConfig: dataLakeConfigToProto(value.dataLakeConfig),
      },
    }),
    fromProto: (value: proto.CreateDataLakeRequest): CreateDataLakeRequest => {
      if (!value.dataLake?.dataLakeConfig) {
        throw new Error("DataLake metadata is undefined");
      }
      return {
        parent: value.parent,
        dataLakeId: value.dataLakeId,
        dataLakeConfig: dataLakeConfigFromProto(value.dataLake.dataLakeConfig),
      };
    },
  },

  GetDataLakeRequest: {
    toProto: Schema.encodeSync(GetDataLakeRequest),
    fromProto: Schema.decodeSync(GetDataLakeRequest),
  },

  ListDataLakesRequest: {
    toProto: Schema.encodeSync(ListDataLakesRequest),
    fromProto: Schema.decodeSync(ListDataLakesRequest),
  },

  ListDataLakesResponse: {
    toProto: (value: ListDataLakesResponse): proto.ListDataLakesResponse => ({
      $type: "wings.v1.cluster_metadata.ListDataLakesResponse",
      dataLakes: value.dataLakes.map(Codec.DataLake.toProto),
      nextPageToken: value.nextPageToken,
    }),
    fromProto: (value: proto.ListDataLakesResponse): ListDataLakesResponse => ({
      dataLakes: value.dataLakes.map(Codec.DataLake.fromProto),
      nextPageToken: value.nextPageToken,
    }),
  },

  DeleteDataLakeRequest: {
    toProto: Schema.encodeSync(DeleteDataLakeRequest),
    fromProto: Schema.decodeSync(DeleteDataLakeRequest),
  },
} as const;
