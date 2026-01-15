import { Schema } from "effect";
import type * as proto from "../../proto/cluster_metadata";
import { tag } from "./helpers";

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

export const CreateDataLakeRequest = Schema.Struct({
  /**
   * The tenant that owns the data lake.
   *
   * Format: tenants/{tenant}
   */
  parent: Schema.String,
  /** The data lake id. */
  dataLakeId: Schema.String,
  /** Data lake configuration. */
  dataLakeConfig: DataLakeConfig,
});

export type CreateDataLakeRequest = typeof CreateDataLakeRequest.Type;

export const GetDataLakeRequest = Schema.Struct({
  /**
   * The data lake name.
   *
   * Format: tenants/{tenant}/data-lakes/{data-lake}
   */
  name: Schema.String,
});

export type GetDataLakeRequest = typeof GetDataLakeRequest.Type;

export const ListDataLakesRequest = Schema.Struct({
  /**
   * The parent tenant.
   *
   * Format: tenants/{tenant}
   */
  parent: Schema.String,
  /** The number of data lakes to return. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

export type ListDataLakesRequest = typeof ListDataLakesRequest.Type;

export const DataLake = Schema.Struct({
  /**
   * The data lake name.
   *
   * Format: tenants/{tenant}/data-lakes/{data-lake}
   */
  name: Schema.String,
  /** Data lake configuration. */
  dataLakeConfig: DataLakeConfig,
});

export type DataLake = typeof DataLake.Type;

export const ListDataLakesResponse = Schema.Struct({
  /** The data lakes. */
  dataLakes: Schema.Array(DataLake),
  /** The continuation token. */
  nextPageToken: Schema.String,
});

export type ListDataLakesResponse = typeof ListDataLakesResponse.Type;

export const DeleteDataLakeRequest = Schema.Struct({
  /**
   * The data lake name.
   *
   * Format: tenants/{tenant}/data-lakes/{data-lake}
   */
  name: Schema.String,
});

export type DeleteDataLakeRequest = typeof DeleteDataLakeRequest.Type;

export const Codec = {
  IcebergConfiguration: {
    toProto: (_value: IcebergConfiguration): proto.IcebergConfiguration => ({
      $type: "wings.v1.cluster_metadata.IcebergConfiguration",
    }),
    fromProto: (_value: proto.IcebergConfiguration): IcebergConfiguration => ({
      _tag: "iceberg",
      iceberg: {},
    }),
  },

  ParquetConfiguration: {
    toProto: (_value: ParquetConfiguration): proto.ParquetConfiguration => ({
      $type: "wings.v1.cluster_metadata.ParquetConfiguration",
    }),
    fromProto: (_value: proto.ParquetConfiguration): ParquetConfiguration => ({
      _tag: "parquet",
      parquet: {},
    }),
  },

  DataLakeConfig: {
    toProto: (value: DataLakeConfig): proto.DataLake["dataLakeConfig"] => {
      switch (value._tag) {
        case "iceberg":
          return {
            $case: "iceberg",
            iceberg: Codec.IcebergConfiguration.toProto(value),
          };
        case "parquet":
          return {
            $case: "parquet",
            parquet: Codec.ParquetConfiguration.toProto(value),
          };
      }
    },
    fromProto: (value: proto.DataLake["dataLakeConfig"]): DataLakeConfig => {
      if (!value) {
        throw new Error("DataLakeConfig is undefined");
      }
      switch (value.$case) {
        case "iceberg":
          return Codec.IcebergConfiguration.fromProto(value.iceberg);
        case "parquet":
          return Codec.ParquetConfiguration.fromProto(value.parquet);
        default:
          throw new Error(`Unknown DataLakeConfig type`);
      }
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
        dataLakeConfig: Codec.DataLakeConfig.toProto(value.dataLakeConfig),
      },
    }),
    fromProto: (value: proto.CreateDataLakeRequest): CreateDataLakeRequest => {
      if (value.dataLake === undefined || !value.dataLake.dataLakeConfig) {
        throw new Error("DataLake metadata is undefined");
      }
      return {
        parent: value.parent,
        dataLakeId: value.dataLakeId,
        dataLakeConfig: Codec.DataLakeConfig.fromProto(
          value.dataLake.dataLakeConfig,
        ),
      };
    },
  },

  DataLake: {
    toProto: (value: DataLake): proto.DataLake => ({
      $type: "wings.v1.cluster_metadata.DataLake",
      name: value.name,
      dataLakeConfig: Codec.DataLakeConfig.toProto(value.dataLakeConfig),
    }),
    fromProto: (value: proto.DataLake): DataLake => {
      if (!value.dataLakeConfig) {
        throw new Error("DataLake config is undefined");
      }
      return {
        name: value.name,
        dataLakeConfig: Codec.DataLakeConfig.fromProto(value.dataLakeConfig),
      };
    },
  },

  GetDataLakeRequest: {
    toProto: (value: GetDataLakeRequest): proto.GetDataLakeRequest => ({
      $type: "wings.v1.cluster_metadata.GetDataLakeRequest",
      name: value.name,
    }),
    fromProto: (value: proto.GetDataLakeRequest): GetDataLakeRequest => ({
      name: value.name,
    }),
  },

  ListDataLakesRequest: {
    toProto: (value: ListDataLakesRequest): proto.ListDataLakesRequest => ({
      $type: "wings.v1.cluster_metadata.ListDataLakesRequest",
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
    fromProto: (value: proto.ListDataLakesRequest): ListDataLakesRequest => ({
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
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
    toProto: (value: DeleteDataLakeRequest): proto.DeleteDataLakeRequest => ({
      $type: "wings.v1.cluster_metadata.DeleteDataLakeRequest",
      name: value.name,
    }),
    fromProto: (value: proto.DeleteDataLakeRequest): DeleteDataLakeRequest => ({
      name: value.name,
    }),
  },
} as const;
