import { Schema } from "apache-arrow";
import { Effect } from "effect";

import type { Field } from "../cluster/arrow-type";
import type { Table } from "../cluster/table";

import { Codec as ArrowTypeCodec } from "../cluster/arrow-type";
import { WingsDecodeError, WingsError } from "../errors";
import { arrowSchemaFromProto, arrowSchemaToProto } from "../lib/arrow";
import { Schema as ProtoSchema } from "../proto/schema/arrow_type";

export type IngestionOperation = "upsert" | "delete";

/** Returns the root table field with the given Wings field id. */
export function getFieldById(table: Table, fieldId: bigint): Field {
  const field = table.schema.fields.find((candidate) => candidate.id === fieldId);
  if (!field) {
    throw new WingsDecodeError(`Table field id ${fieldId.toString()} is undefined`);
  }
  return field;
}

/** Returns the table field Wings uses as the logical record key. */
export const getKeyField = (table: Table): Field => getFieldById(table, table.keyFieldId);

/** Returns the table field Wings uses to order mutations for the same key. */
export const getVersionField = (table: Table): Field => getFieldById(table, table.versionFieldId);

/** Returns the partition field when the table is partitioned. */
export const getPartitionField = (table: Table): Field | undefined =>
  table.partitionFieldId === undefined ? undefined : getFieldById(table, table.partitionFieldId);

/**
 * Returns a table's Arrow schema synchronously.
 * Use this in places where missing schema data should fail immediately.
 */
export function tableSchemaUnsafe(table: Table): Schema {
  if (!table.schema) {
    throw new WingsDecodeError("Table schema is undefined");
  }

  return arrowSchemaFromProto(ArrowTypeCodec.ArrowSchema.toProto(table.schema));
}

/**
 * Returns the Arrow schema Wings expects for a specific ingestion operation.
 * Upserts use the table schema minus the partition field; deletes use key/version only.
 */
export function ingestionSchemaUnsafe(table: Table, operation: IngestionOperation): Schema {
  const fullSchema = tableSchemaUnsafe(table);
  const fieldIndex = (fieldId: bigint) => {
    const index = table.schema.fields.findIndex((field) => field.id === fieldId);
    if (index === -1) {
      throw new WingsDecodeError(`Table field id ${fieldId.toString()} is undefined`);
    }
    return index;
  };

  if (operation === "delete") {
    return new Schema([
      fullSchema.fields[fieldIndex(table.keyFieldId)],
      fullSchema.fields[fieldIndex(table.versionFieldId)],
    ]);
  }

  const partitionIndex =
    table.partitionFieldId === undefined ? undefined : fieldIndex(table.partitionFieldId);
  return partitionIndex === undefined
    ? fullSchema
    : new Schema(
        fullSchema.fields.filter((_, index) => index !== partitionIndex),
        fullSchema.metadata,
      );
}

/**
 * Decodes a table's Arrow schema into an `Effect`.
 * This is the recommended entry point when the table comes from external data.
 */
export const tableSchema = (table: Table) =>
  Effect.try({
    try: () => tableSchemaUnsafe(table),
    catch: (cause) =>
      new WingsError({
        message: "Failed to decode table schema",
        cause,
      }),
  });

/** Decodes the expected ingestion Arrow schema into an `Effect`. */
export const ingestionSchema = (table: Table, operation: IngestionOperation) =>
  Effect.try({
    try: () => ingestionSchemaUnsafe(table, operation),
    catch: (cause) =>
      new WingsError({
        message: `Failed to decode ${operation} ingestion schema`,
        cause,
      }),
  });

/** Serializes an Arrow schema into the bytes used by Wings APIs. */
export function encodeTableSchema(schema: Schema): Uint8Array {
  const protoSchema = arrowSchemaToProto(schema);
  return ProtoSchema.encode(protoSchema).finish();
}
