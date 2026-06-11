import type { Schema } from "apache-arrow";

import { Effect } from "effect";

import type { Table } from "../cluster/table";

import { Codec as ArrowTypeCodec } from "../cluster/arrow-type";
import { WingsDecodeError, WingsError } from "../errors";
import { arrowSchemaFromProto, arrowSchemaToProto } from "../lib/arrow";
import { Schema as ProtoSchema } from "../proto/schema/arrow_type";

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

/** Serializes an Arrow schema into the bytes used by Wings APIs. */
export function encodeTableSchema(schema: Schema): Uint8Array {
  const protoSchema = arrowSchemaToProto(schema);
  return ProtoSchema.encode(protoSchema).finish();
}
