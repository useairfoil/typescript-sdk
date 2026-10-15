import { Iceberg } from "@useairfoil/connector-kit";
import { Schema } from "effect";

export const field = (fieldId: number, description: string) =>
  Iceberg.field(fieldId, { description });

/** Salesforce times, such as `2026-10-15T10:26:49.000+0000`. */
export const Timestamp = Schema.DateFromString;

export const version = (fieldId: number) =>
  Schema.Date.pipe(field(fieldId, "Time the row was fetched from Salesforce."));

export const deleted = (fieldId: number) =>
  Schema.optional(Schema.Boolean).pipe(
    field(fieldId, "Whether the record was deleted or merged into another record in Salesforce."),
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
