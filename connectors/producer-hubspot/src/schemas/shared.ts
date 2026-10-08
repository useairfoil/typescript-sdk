import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, SchemaTransformation } from "effect";

export const field = (fieldId: number, description: string) =>
  Iceberg.field(fieldId, { description });

export const Timestamp = Schema.DateFromString;

/** Whole numbers. Connector Kit maps them to Iceberg longs. */
export const Long = Schema.Int.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => BigInt(value),
      encode: (value) => Number(value),
    }),
  ),
);

/** Record IDs. Some endpoints send them as numbers. */
export const RecordId = Schema.Union([Schema.String, Schema.Number]).pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transform<string, string | number>({ decode: String, encode: (id) => id }),
  ),
);

export const version = (fieldId: number) =>
  Schema.Date.pipe(field(fieldId, "Time the row was fetched from HubSpot."));

export const deleted = (fieldId: number, object: string) =>
  Schema.optional(Schema.Boolean).pipe(
    field(fieldId, `Whether the ${object} was deleted or merged into another record in HubSpot.`),
  );

/** A string map column. Key and value IDs are separate from the column's field ID. */
export const stringMap = (keyId: number, valueId: number) =>
  Schema.ReadonlyMap(
    Schema.String.annotate({ fieldId: keyId }),
    Schema.String.annotate({ fieldId: valueId }),
  );

/** A list column. The element ID is separate from the column's field ID. */
export const list = <S extends Schema.Top>(elementId: number, item: S) =>
  Schema.Array(item.annotate({ fieldId: elementId }));
