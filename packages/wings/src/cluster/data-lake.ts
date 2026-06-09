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

const IcebergConfigurationProto = Schema.Struct({
  $case: Schema.Literal("iceberg"),
  iceberg: Schema.Struct({
    $type: Schema.Literal("wings.cluster.IcebergConfiguration"),
  }),
});

const ParquetConfigurationProto = Schema.Struct({
  $case: Schema.Literal("parquet"),
  parquet: Schema.Struct({
    $type: Schema.Literal("wings.cluster.ParquetConfiguration"),
  }),
});

const DeltaConfigurationProto = Schema.Struct({
  $case: Schema.Literal("delta"),
  delta: Schema.Struct({
    $type: Schema.Literal("wings.cluster.DeltaConfiguration"),
  }),
});

export const LakeProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.Lake"),
  lakeConfig: Schema.optional(
    Schema.Union([IcebergConfigurationProto, ParquetConfigurationProto, DeltaConfigurationProto]),
  ),
});

export type LakeProto = typeof LakeProto.Type;

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

export type IcebergConfigurationApp = typeof IcebergConfigurationApp.Type;

export const ParquetConfigurationApp = Schema.TaggedStruct("parquet", {
  parquet: Schema.Struct({}),
});

export type ParquetConfigurationApp = typeof ParquetConfigurationApp.Type;

export const DeltaConfigurationApp = Schema.TaggedStruct("delta", {
  delta: Schema.Struct({}),
});

export type DeltaConfigurationApp = typeof DeltaConfigurationApp.Type;

const LakeConfigApp = Schema.Union([
  IcebergConfigurationApp,
  ParquetConfigurationApp,
  DeltaConfigurationApp,
]);

type LakeConfigApp = typeof LakeConfigApp.Type;

export const LakeApp = Schema.Struct({
  /** Lake configuration. */
  lakeConfig: LakeConfigApp,
});

export type LakeApp = typeof LakeApp.Type;

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

const LakeConfigProto = Schema.Union([
  IcebergConfigurationProto,
  ParquetConfigurationProto,
  DeltaConfigurationProto,
]);

type LakeConfigProto = typeof LakeConfigProto.Type;

export const LakeConfig = LakeConfigProto.pipe(
  Schema.decodeTo(
    LakeConfigApp,
    SchemaTransformation.transform({
      decode: (proto): LakeConfigApp => {
        switch (proto.$case) {
          case "iceberg":
            return { _tag: "iceberg" as const, iceberg: {} };
          case "parquet":
            return { _tag: "parquet" as const, parquet: {} };
          case "delta":
            return { _tag: "delta" as const, delta: {} };
          default:
            throw new WingsDecodeError("Unsupported lake config");
        }
      },
      encode: (app): LakeConfigProto => {
        switch (app._tag) {
          case "iceberg":
            return {
              $case: "iceberg" as const,
              iceberg: {
                $type: "wings.cluster.IcebergConfiguration" as const,
              },
            };
          case "parquet":
            return {
              $case: "parquet" as const,
              parquet: {
                $type: "wings.cluster.ParquetConfiguration" as const,
              },
            };
          case "delta":
            return {
              $case: "delta" as const,
              delta: {
                $type: "wings.cluster.DeltaConfiguration" as const,
              },
            };
          default:
            throw new WingsDecodeError("Unsupported lake config");
        }
      },
    }),
  ),
);

export type LakeConfig = typeof LakeConfig.Type;

export const Lake = LakeProto.pipe(
  Schema.decodeTo(
    LakeApp,
    SchemaTransformation.transform({
      decode: (proto): LakeApp => {
        if (!proto.lakeConfig) {
          throw new WingsDecodeError("Lake config is undefined");
        }
        return {
          lakeConfig: Schema.decodeSync(LakeConfig)(proto.lakeConfig),
        };
      },
      encode: (app): LakeProto => ({
        $type: "wings.cluster.Lake" as const,
        lakeConfig: Schema.encodeSync(LakeConfig)(app.lakeConfig),
      }),
    }),
  ),
);

export type Lake = typeof Lake.Type;
