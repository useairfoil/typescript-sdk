import { Schema as ApacheArrowSchema } from "apache-arrow";
import { Schema, SchemaTransformation } from "effect";

import { WingsDecodeError } from "../errors";
import {
  arrowFieldToFieldConfig,
  arrowSchemaFromProto,
  arrowSchemaToProto,
  createArrowField,
  type FieldConfig,
} from "../lib/arrow";
import { Codec as ArrowCodec, ArrowSchema } from "./arrow-type";

//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const TableProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.Table"),
  name: Schema.String,
  schema: Schema.optional(Schema.Any),
  description: Schema.optional(Schema.String),
  keyFieldId: Schema.BigInt,
  versionFieldId: Schema.BigInt,
  partitionFieldId: Schema.optional(Schema.BigInt),
  targetFreshnessSeconds: Schema.BigInt,
});

type TableProto = typeof TableProto.Type;

const CreateTableRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.CreateTableRequest"),
  parent: Schema.String,
  tableId: Schema.String,
  table: Schema.optional(TableProto),
});

type CreateTableRequestProto = typeof CreateTableRequestProto.Type;

const GetTableRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.GetTableRequest"),
  name: Schema.String,
});

type GetTableRequestProto = typeof GetTableRequestProto.Type;

const ListTablesRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.ListTablesRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListTablesRequestProto = typeof ListTablesRequestProto.Type;

const ListTablesResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.ListTablesResponse"),
  tables: Schema.Array(TableProto),
  nextPageToken: Schema.String,
});

type ListTablesResponseProto = typeof ListTablesResponseProto.Type;

const DeleteTableRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.DeleteTableRequest"),
  name: Schema.String,
});

type DeleteTableRequestProto = typeof DeleteTableRequestProto.Type;

//    █████████   ███████████  ███████████
//   ███░░░░░███ ░░███░░░░░███░░███░░░░░███
//  ░███    ░███  ░███    ░███ ░███    ░███
//  ░███████████  ░██████████  ░██████████
//  ░███░░░░░███  ░███░░░░░░   ░███░░░░░░
//  ░███    ░███  ░███         ░███
//  █████   █████ █████        █████
// ░░░░░   ░░░░░ ░░░░░        ░░░░░

const isFieldConfig = (input: unknown): input is FieldConfig => {
  if (typeof input !== "object" || input === null) return false;
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.nullable === "boolean" &&
    typeof obj.dataType === "string" &&
    typeof obj.id === "bigint"
  );
};

const FieldConfigSchema = Schema.declare(isFieldConfig, {
  identifier: "FieldConfig",
  description: "A valid Arrow field configuration",
});

const TableApp = Schema.Struct({
  name: Schema.String,
  schema: ArrowSchema,
  description: Schema.optional(Schema.String),
  keyFieldId: Schema.BigInt,
  versionFieldId: Schema.BigInt,
  partitionFieldId: Schema.optional(Schema.BigInt),
  targetFreshnessSeconds: Schema.BigInt,
});

type TableApp = typeof TableApp.Type;

const CreateTableRequestApp = Schema.Struct({
  parent: Schema.String,
  tableId: Schema.String,
  fields: Schema.mutable(Schema.Array(FieldConfigSchema)),
  description: Schema.optional(Schema.String),
  keyFieldId: Schema.BigInt,
  versionFieldId: Schema.BigInt,
  partitionFieldId: Schema.optional(Schema.BigInt),
  targetFreshnessSeconds: Schema.BigInt,
});

type CreateTableRequestApp = typeof CreateTableRequestApp.Type;

const GetTableRequestApp = Schema.Struct({
  name: Schema.String,
});

type GetTableRequestApp = typeof GetTableRequestApp.Type;

const ListTablesRequestApp = Schema.Struct({
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListTablesRequestApp = typeof ListTablesRequestApp.Type;

const DeleteTableRequestApp = Schema.Struct({
  name: Schema.String,
});

type DeleteTableRequestApp = typeof DeleteTableRequestApp.Type;

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const Table = TableProto.pipe(
  Schema.decodeTo(
    TableApp,
    SchemaTransformation.transform({
      decode: (proto): TableApp => {
        if (!proto.schema) {
          throw new WingsDecodeError("Table schema is undefined");
        }
        return {
          name: proto.name,
          schema: ArrowCodec.ArrowSchema.fromProto(proto.schema),
          description: proto.description,
          keyFieldId: proto.keyFieldId,
          versionFieldId: proto.versionFieldId,
          partitionFieldId: proto.partitionFieldId,
          targetFreshnessSeconds: proto.targetFreshnessSeconds,
        };
      },
      encode: (app): TableProto => ({
        $type: "wings.cluster.Table" as const,
        name: app.name,
        schema: ArrowCodec.ArrowSchema.toProto(app.schema),
        description: app.description,
        keyFieldId: app.keyFieldId,
        versionFieldId: app.versionFieldId,
        partitionFieldId: app.partitionFieldId,
        targetFreshnessSeconds: app.targetFreshnessSeconds,
      }),
    }),
  ),
);

export type Table = typeof Table.Type;

export const CreateTableRequest = CreateTableRequestProto.pipe(
  Schema.decodeTo(
    CreateTableRequestApp,
    SchemaTransformation.transform({
      decode: (proto): CreateTableRequestApp => {
        if (!proto.table) {
          throw new WingsDecodeError("Table metadata is undefined");
        }
        if (!proto.table.schema) {
          throw new WingsDecodeError("Table schema is undefined");
        }
        const schema = arrowSchemaFromProto(proto.table.schema);
        return {
          parent: proto.parent,
          tableId: proto.tableId,
          fields: Array.from(schema.fields.map(arrowFieldToFieldConfig)),
          description: proto.table.description,
          keyFieldId: proto.table.keyFieldId,
          versionFieldId: proto.table.versionFieldId,
          partitionFieldId: proto.table.partitionFieldId,
          targetFreshnessSeconds: proto.table.targetFreshnessSeconds,
        };
      },
      encode: (app): CreateTableRequestProto => ({
        $type: "wings.cluster.CreateTableRequest" as const,
        parent: app.parent,
        tableId: app.tableId,
        table: {
          $type: "wings.cluster.Table" as const,
          name: `${app.parent}/tables/${app.tableId}`,
          schema: arrowSchemaToProto(new ApacheArrowSchema(app.fields.map(createArrowField))),
          description: app.description,
          keyFieldId: app.keyFieldId,
          versionFieldId: app.versionFieldId,
          partitionFieldId: app.partitionFieldId,
          targetFreshnessSeconds: app.targetFreshnessSeconds,
        },
      }),
    }),
  ),
);

export type CreateTableRequest = typeof CreateTableRequest.Type;

export const GetTableRequest = GetTableRequestProto.pipe(
  Schema.decodeTo(
    GetTableRequestApp,
    SchemaTransformation.transform({
      decode: (proto): GetTableRequestApp => ({ name: proto.name }),
      encode: (app): GetTableRequestProto => ({
        $type: "wings.cluster.GetTableRequest" as const,
        name: app.name,
      }),
    }),
  ),
);

export type GetTableRequest = typeof GetTableRequest.Type;

export const ListTablesRequest = ListTablesRequestProto.pipe(
  Schema.decodeTo(
    ListTablesRequestApp,
    SchemaTransformation.transform({
      decode: (proto): ListTablesRequestApp => ({
        parent: proto.parent,
        pageSize: proto.pageSize,
        pageToken: proto.pageToken,
      }),
      encode: (app): ListTablesRequestProto => ({
        $type: "wings.cluster.ListTablesRequest" as const,
        parent: app.parent,
        pageSize: app.pageSize,
        pageToken: app.pageToken,
      }),
    }),
  ),
);

export type ListTablesRequest = typeof ListTablesRequest.Type;

export const DeleteTableRequest = DeleteTableRequestProto.pipe(
  Schema.decodeTo(
    DeleteTableRequestApp,
    SchemaTransformation.transform({
      decode: (proto): DeleteTableRequestApp => ({ name: proto.name }),
      encode: (app): DeleteTableRequestProto => ({
        $type: "wings.cluster.DeleteTableRequest" as const,
        name: app.name,
      }),
    }),
  ),
);

export type DeleteTableRequest = typeof DeleteTableRequest.Type;

const ListTablesResponseApp = Schema.Struct({
  tables: Schema.Array(TableApp),
  nextPageToken: Schema.String,
});

type ListTablesResponseApp = typeof ListTablesResponseApp.Type;

export const ListTablesResponse = ListTablesResponseProto.pipe(
  Schema.decodeTo(
    ListTablesResponseApp,
    SchemaTransformation.transform({
      decode: (proto): ListTablesResponseApp => ({
        tables: proto.tables.map((t) => Schema.decodeSync(Table)(t)),
        nextPageToken: proto.nextPageToken,
      }),
      encode: (app): ListTablesResponseProto => ({
        $type: "wings.cluster.ListTablesResponse" as const,
        tables: app.tables.map((t) => Schema.encodeSync(Table)(t)),
        nextPageToken: app.nextPageToken,
      }),
    }),
  ),
);

export type ListTablesResponse = typeof ListTablesResponse.Type;

//    █████████     ███████    ██████████   ██████████   █████████
//   ███░░░░░███  ███░░░░░███ ░░███░░░░███ ░░███░░░░░█  ███░░░░░███
//  ███     ░░░  ███     ░░███ ░███   ░░███ ░███  █ ░  ███     ░░░
// ░███         ░███      ░███ ░███    ░███ ░██████   ░███
// ░███         ░███      ░███ ░███    ░███ ░███░░█   ░███
// ░░███     ███░░███     ███  ░███    ███  ░███ ░   █░░███     ███
//  ░░█████████  ░░░███████░   ██████████   ██████████ ░░█████████
//   ░░░░░░░░░     ░░░░░░░    ░░░░░░░░░░   ░░░░░░░░░░   ░░░░░░░░░

export const Codec = {
  Table: {
    toProto: Schema.encodeSync(Table),
    fromProto: Schema.decodeSync(Table),
  },

  CreateTableRequest: {
    toProto: Schema.encodeSync(CreateTableRequest),
    fromProto: Schema.decodeSync(CreateTableRequest),
  },

  GetTableRequest: {
    toProto: Schema.encodeSync(GetTableRequest),
    fromProto: Schema.decodeSync(GetTableRequest),
  },

  ListTablesRequest: {
    toProto: Schema.encodeSync(ListTablesRequest),
    fromProto: Schema.decodeSync(ListTablesRequest),
  },

  ListTablesResponse: {
    toProto: Schema.encodeSync(ListTablesResponse),
    fromProto: Schema.decodeSync(ListTablesResponse),
  },

  DeleteTableRequest: {
    toProto: Schema.encodeSync(DeleteTableRequest),
    fromProto: Schema.decodeSync(DeleteTableRequest),
  },
} as const;
