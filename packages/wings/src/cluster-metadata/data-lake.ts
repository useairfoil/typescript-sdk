import { type Codec, type CodecType, OneOfCodec } from "../lib/codec";
import type * as proto from "../proto/cluster_metadata";

// biome-ignore lint/complexity/noBannedTypes: <>
export const IcebergConfiguration: Codec<{}, proto.IcebergConfiguration> = {
  encode(_value) {
    return {
      $type: "wings.v1.cluster_metadata.IcebergConfiguration",
    };
  },
  decode(_value) {
    return {};
  },
};

export type IcebergConfiguration = CodecType<typeof IcebergConfiguration>;

// biome-ignore lint/complexity/noBannedTypes: <>
export const ParquetConfiguration: Codec<{}, proto.ParquetConfiguration> = {
  encode(_value) {
    return {
      $type: "wings.v1.cluster_metadata.ParquetConfiguration",
    };
  },
  decode(_value) {
    return {};
  },
};

export type ParquetConfiguration = CodecType<typeof ParquetConfiguration>;

export const DataLakeConfig = OneOfCodec({
  iceberg: IcebergConfiguration,
  parquet: ParquetConfiguration,
});

export type DataLakeConfig = CodecType<typeof DataLakeConfig>;

export const CreateDataLakeRequest: Codec<
  {
    /**
     * The tenant that owns the data lake.
     *
     * Format: tenants/{tenant}
     */
    parent: string;
    /** The data lake id. */
    dataLakeId: string;
    /** Data lake configuration. */
    dataLakeConfig: DataLakeConfig;
  },
  proto.CreateDataLakeRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.CreateDataLakeRequest",
      parent: value.parent,
      dataLakeId: value.dataLakeId,
      dataLake: DataLake.encode({
        name: `${value.parent}/data-lakes/${value.dataLakeId}`,
        dataLakeConfig: value.dataLakeConfig,
      }),
    };
  },
  decode(value) {
    if (value.dataLake === undefined) {
      throw new Error("DataLake metadata is undefined");
    }

    const decoded = DataLake.decode(value.dataLake);
    return {
      parent: value.parent,
      dataLakeId: value.dataLakeId,
      dataLakeConfig: decoded.dataLakeConfig,
    };
  },
};

export type CreateDataLakeRequest = CodecType<typeof CreateDataLakeRequest>;

export const GetDataLakeRequest: Codec<
  {
    /**
     * The data lake name.
     *
     * Format: tenants/{tenant}/data-lakes/{data-lake}
     */
    name: string;
  },
  proto.GetDataLakeRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.GetDataLakeRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type GetDataLakeRequest = CodecType<typeof GetDataLakeRequest>;

export const ListDataLakesRequest: Codec<
  {
    /**
     * The parent tenant.
     *
     * Format: tenants/{tenant}
     */
    parent: string;
    /** The number of data lakes to return. */
    pageSize?: number;
    /** The continuation token. */
    pageToken?: string;
  },
  proto.ListDataLakesRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListDataLakesRequest",
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

export type ListDataLakesRequest = CodecType<typeof ListDataLakesRequest>;

export const ListDataLakesResponse: Codec<
  {
    /** The data lakes. */
    dataLakes: DataLake[];
    /** The continuation token. */
    nextPageToken: string;
  },
  proto.ListDataLakesResponse
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListDataLakesResponse",
      dataLakes: value.dataLakes.map(DataLake.encode),
      nextPageToken: value.nextPageToken,
    };
  },
  decode(value) {
    return {
      dataLakes: value.dataLakes.map(DataLake.decode),
      nextPageToken: value.nextPageToken,
    };
  },
};

export type ListDataLakesResponse = CodecType<typeof ListDataLakesResponse>;

export const DeleteDataLakeRequest: Codec<
  {
    /**
     * The data lake name.
     *
     * Format: tenants/{tenant}/data-lakes/{data-lake}
     */
    name: string;
  },
  proto.DeleteDataLakeRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.DeleteDataLakeRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type DeleteDataLakeRequest = CodecType<typeof DeleteDataLakeRequest>;

export const DataLake: Codec<
  {
    /**
     * The data lake name.
     *
     * Format: tenants/{tenant}/data-lakes/{data-lake}
     */
    name: string;
    /** Data lake configuration. */
    dataLakeConfig: DataLakeConfig;
  },
  proto.DataLake
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.DataLake",
      name: value.name,
      dataLakeConfig: value.dataLakeConfig
        ? DataLakeConfig.encode(value.dataLakeConfig)
        : undefined,
    };
  },
  decode(value) {
    if (value.dataLakeConfig === undefined) {
      throw new Error("DataLakeConfig is undefined");
    }
    return {
      name: value.name,
      dataLakeConfig: DataLakeConfig.decode(value.dataLakeConfig),
    };
  },
};

export type DataLake = CodecType<typeof DataLake>;
