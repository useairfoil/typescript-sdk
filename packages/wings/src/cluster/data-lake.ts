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

const GetDataLakeRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetDataLakeRequest"),
  name: Schema.String,
});

type GetDataLakeRequestProto = typeof GetDataLakeRequestProto.Type;

const ListDataLakesRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListDataLakesRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListDataLakesRequestProto = typeof ListDataLakesRequestProto.Type;

const DeleteDataLakeRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteDataLakeRequest"),
  name: Schema.String,
});

type DeleteDataLakeRequestProto = typeof DeleteDataLakeRequestProto.Type;

const IcebergConfigurationProto = Schema.Struct({
  $case: Schema.Literal("iceberg"),
  iceberg: Schema.Struct({
    $type: Schema.Literal("wings.v1.cluster_metadata.IcebergConfiguration"),
  }),
});

const ParquetConfigurationProto = Schema.Struct({
  $case: Schema.Literal("parquet"),
  parquet: Schema.Struct({
    $type: Schema.Literal("wings.v1.cluster_metadata.ParquetConfiguration"),
  }),
});

const DeltaConfigurationProto = Schema.Struct({
  $case: Schema.Literal("delta"),
  delta: Schema.Struct({
    $type: Schema.Literal("wings.v1.cluster_metadata.DeltaConfiguration"),
    objectStore: Schema.optional(Schema.String),
  }),
});

const DataLakeProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DataLake"),
  name: Schema.String,
  dataLakeConfig: Schema.optional(
    Schema.Union([IcebergConfigurationProto, ParquetConfigurationProto, DeltaConfigurationProto]),
  ),
});

type DataLakeProto = typeof DataLakeProto.Type;

const CreateDataLakeRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.CreateDataLakeRequest"),
  parent: Schema.String,
  dataLakeId: Schema.String,
  dataLake: Schema.optional(DataLakeProto),
});

type CreateDataLakeRequestProto = typeof CreateDataLakeRequestProto.Type;

const ListDataLakesResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListDataLakesResponse"),
  dataLakes: Schema.Array(DataLakeProto),
  nextPageToken: Schema.String,
});

type ListDataLakesResponseProto = typeof ListDataLakesResponseProto.Type;

//    █████████   ███████████  ███████████
//   ███░░░░░███ ░░███░░░░░███░░███░░░░░███
//  ░███    ░███  ░███    ░███ ░███    ░███
//  ░███████████  ░██████████  ░██████████
//  ░███░░░░░███  ░███░░░░░░   ░███░░░░░░
//  ░███    ░███  ░███         ░███
//  █████   █████ █████        █████
// ░░░░░   ░░░░░ ░░░░░        ░░░░░

export const IcebergConfigurationApp = Schema.TaggedStruct("iceberg", {
  iceberg: Schema.Struct({}),
});

export const ParquetConfigurationApp = Schema.TaggedStruct("parquet", {
  parquet: Schema.Struct({}),
});

export const DeltaConfigurationApp = Schema.TaggedStruct("delta", {
  delta: Schema.Struct({
    objectStore: Schema.optional(Schema.String),
  }),
});

export const DataLakeConfigApp = Schema.Union([
  IcebergConfigurationApp,
  ParquetConfigurationApp,
  DeltaConfigurationApp,
]);

type DataLakeConfigApp = typeof DataLakeConfigApp.Type;

export const DataLakeApp = Schema.Struct({
  /** The data lake name. Format: tenants/{tenant}/data-lakes/{data-lake} */
  name: Schema.String,
  /** Data lake configuration. */
  dataLakeConfig: DataLakeConfigApp,
});

type DataLakeApp = typeof DataLakeApp.Type;

export const CreateDataLakeRequestApp = Schema.Struct({
  /** The tenant that owns the data lake. Format: tenants/{tenant} */
  parent: Schema.String,
  /** The data lake id. */
  dataLakeId: Schema.String,
  /** Data lake configuration. */
  dataLakeConfig: DataLakeConfigApp,
});

type CreateDataLakeRequestApp = typeof CreateDataLakeRequestApp.Type;

const GetDataLakeRequestApp = Schema.Struct({
  /** The data lake name. Format: tenants/{tenant}/data-lakes/{data-lake} */
  name: Schema.String,
});

type GetDataLakeRequestApp = typeof GetDataLakeRequestApp.Type;

const ListDataLakesRequestApp = Schema.Struct({
  /** The parent tenant. Format: tenants/{tenant} */
  parent: Schema.String,
  /** The number of data lakes to return. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

type ListDataLakesRequestApp = typeof ListDataLakesRequestApp.Type;

export const ListDataLakesResponseApp = Schema.Struct({
  dataLakes: Schema.Array(DataLakeApp),
  nextPageToken: Schema.String,
});

type ListDataLakesResponseApp = typeof ListDataLakesResponseApp.Type;

const DeleteDataLakeRequestApp = Schema.Struct({
  /** The data lake name. Format: tenants/{tenant}/data-lakes/{data-lake} */
  name: Schema.String,
});

type DeleteDataLakeRequestApp = typeof DeleteDataLakeRequestApp.Type;

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const GetDataLakeRequest = GetDataLakeRequestProto.pipe(
  Schema.decodeTo(
    GetDataLakeRequestApp,
    SchemaTransformation.transform({
      decode: (proto): GetDataLakeRequestApp => ({ name: proto.name }),
      encode: (app): GetDataLakeRequestProto => ({
        $type: "wings.v1.cluster_metadata.GetDataLakeRequest" as const,
        name: app.name,
      }),
    }),
  ),
);

export type GetDataLakeRequest = typeof GetDataLakeRequest.Type;

export const ListDataLakesRequest = ListDataLakesRequestProto.pipe(
  Schema.decodeTo(
    ListDataLakesRequestApp,
    SchemaTransformation.transform({
      decode: (proto): ListDataLakesRequestApp => ({
        parent: proto.parent,
        pageSize: proto.pageSize,
        pageToken: proto.pageToken,
      }),
      encode: (app): ListDataLakesRequestProto => ({
        $type: "wings.v1.cluster_metadata.ListDataLakesRequest" as const,
        parent: app.parent,
        pageSize: app.pageSize,
        pageToken: app.pageToken,
      }),
    }),
  ),
);

export type ListDataLakesRequest = typeof ListDataLakesRequest.Type;

export const DeleteDataLakeRequest = DeleteDataLakeRequestProto.pipe(
  Schema.decodeTo(
    DeleteDataLakeRequestApp,
    SchemaTransformation.transform({
      decode: (proto): DeleteDataLakeRequestApp => ({ name: proto.name }),
      encode: (app): DeleteDataLakeRequestProto => ({
        $type: "wings.v1.cluster_metadata.DeleteDataLakeRequest" as const,
        name: app.name,
      }),
    }),
  ),
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

const DataLakeConfigProto = Schema.Union([
  IcebergConfigurationProto,
  ParquetConfigurationProto,
  DeltaConfigurationProto,
]);

type DataLakeConfigProto = typeof DataLakeConfigProto.Type;

export const DataLakeConfig = DataLakeConfigProto.pipe(
  Schema.decodeTo(
    DataLakeConfigApp,
    SchemaTransformation.transform({
      decode: (proto): DataLakeConfigApp => {
        switch (proto.$case) {
          case "iceberg":
            return { _tag: "iceberg" as const, iceberg: {} };
          case "parquet":
            return { _tag: "parquet" as const, parquet: {} };
          case "delta":
            return {
              _tag: "delta" as const,
              delta: { objectStore: proto.delta.objectStore },
            };
          default:
            throw new WingsDecodeError("Unsupported data lake config");
        }
      },
      encode: (app): DataLakeConfigProto => {
        switch (app._tag) {
          case "iceberg":
            return {
              $case: "iceberg" as const,
              iceberg: {
                $type: "wings.v1.cluster_metadata.IcebergConfiguration" as const,
              },
            };
          case "parquet":
            return {
              $case: "parquet" as const,
              parquet: {
                $type: "wings.v1.cluster_metadata.ParquetConfiguration" as const,
              },
            };
          case "delta":
            return {
              $case: "delta" as const,
              delta: {
                $type: "wings.v1.cluster_metadata.DeltaConfiguration" as const,
                objectStore: app.delta.objectStore,
              },
            };
          default:
            throw new WingsDecodeError("Unsupported data lake config");
        }
      },
    }),
  ),
);

export type DataLakeConfig = typeof DataLakeConfig.Type;

export const DataLake = DataLakeProto.pipe(
  Schema.decodeTo(
    DataLakeApp,
    SchemaTransformation.transform({
      decode: (proto): DataLakeApp => {
        if (!proto.dataLakeConfig) {
          throw new WingsDecodeError("DataLake config is undefined");
        }
        return {
          name: proto.name,
          dataLakeConfig: Schema.decodeSync(DataLakeConfig)(proto.dataLakeConfig),
        };
      },
      encode: (app): DataLakeProto => ({
        $type: "wings.v1.cluster_metadata.DataLake" as const,
        name: app.name,
        dataLakeConfig: Schema.encodeSync(DataLakeConfig)(app.dataLakeConfig),
      }),
    }),
  ),
);

export type DataLake = typeof DataLake.Type;

export const CreateDataLakeRequest = CreateDataLakeRequestProto.pipe(
  Schema.decodeTo(
    CreateDataLakeRequestApp,
    SchemaTransformation.transform({
      decode: (proto): CreateDataLakeRequestApp => {
        if (!proto.dataLake?.dataLakeConfig) {
          throw new WingsDecodeError("DataLake metadata is undefined");
        }
        return {
          parent: proto.parent,
          dataLakeId: proto.dataLakeId,
          dataLakeConfig: Schema.decodeSync(DataLakeConfig)(proto.dataLake.dataLakeConfig),
        };
      },
      encode: (app): CreateDataLakeRequestProto => ({
        $type: "wings.v1.cluster_metadata.CreateDataLakeRequest" as const,
        parent: app.parent,
        dataLakeId: app.dataLakeId,
        dataLake: {
          $type: "wings.v1.cluster_metadata.DataLake" as const,
          name: `${app.parent}/data-lakes/${app.dataLakeId}`,
          dataLakeConfig: Schema.encodeSync(DataLakeConfig)(app.dataLakeConfig),
        },
      }),
    }),
  ),
);

export type CreateDataLakeRequest = typeof CreateDataLakeRequest.Type;

export const ListDataLakesResponse = ListDataLakesResponseProto.pipe(
  Schema.decodeTo(
    ListDataLakesResponseApp,
    SchemaTransformation.transform({
      decode: (proto): ListDataLakesResponseApp => ({
        dataLakes: proto.dataLakes.map((lake) => Schema.decodeSync(DataLake)(lake)),
        nextPageToken: proto.nextPageToken,
      }),
      encode: (app): ListDataLakesResponseProto => ({
        $type: "wings.v1.cluster_metadata.ListDataLakesResponse" as const,
        dataLakes: app.dataLakes.map((lake) => Schema.encodeSync(DataLake)(lake)),
        nextPageToken: app.nextPageToken,
      }),
    }),
  ),
);

export type ListDataLakesResponse = typeof ListDataLakesResponse.Type;

export const Codec = {
  DataLake: {
    toProto: Schema.encodeSync(DataLake),
    fromProto: Schema.decodeSync(DataLake),
  },

  CreateDataLakeRequest: {
    toProto: Schema.encodeSync(CreateDataLakeRequest),
    fromProto: Schema.decodeSync(CreateDataLakeRequest),
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
    toProto: Schema.encodeSync(ListDataLakesResponse),
    fromProto: Schema.decodeSync(ListDataLakesResponse),
  },

  DeleteDataLakeRequest: {
    toProto: Schema.encodeSync(DeleteDataLakeRequest),
    fromProto: Schema.decodeSync(DeleteDataLakeRequest),
  },
} as const;
