import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, SchemaTransformation } from "effect";

export const field = (fieldId: number, description: string) =>
  Iceberg.field(fieldId, { description });

export const Long = Schema.Int.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => BigInt(value),
      encode: (value) => Number(value),
    }),
  ),
);

export const LongFromString = Schema.NumberFromString.pipe(Schema.decodeTo(Long));

export const Timestamp = Schema.DateFromString;

export const UnixSeconds = Schema.Number.pipe(
  Schema.decodeTo(
    Schema.Date,
    SchemaTransformation.transform({
      decode: (seconds) => new Date(seconds * 1000),
      encode: (date) => date.getTime() / 1000,
    }),
  ),
);

export const version = (fieldId: number, object: string) =>
  Schema.Date.pipe(field(fieldId, `Time Zendesk last updated the ${object}.`));

export const deleted = (fieldId: number, object: string) =>
  Schema.optional(Schema.Boolean).pipe(
    field(fieldId, `Whether the ${object} was deleted in Zendesk.`),
  );

export const list = <S extends Schema.Top>(elementId: number, item: S) =>
  Schema.Array(item.annotate({ fieldId: elementId }));

export const stringMap = (keyId: number, valueId: number) =>
  Schema.ReadonlyMap(
    Schema.String.annotate({ fieldId: keyId }),
    Schema.String.annotate({ fieldId: valueId }),
  );

// Keep list values as JSON. Null values are left out of the map.
const fieldValue = (value: unknown): ReadonlyArray<string> =>
  value === null || value === undefined
    ? []
    : [typeof value === "string" ? value : JSON.stringify(value)];

/** Ticket `custom_fields`, as a map from field ID to value. */
export const ticketCustomFields = Schema.Array(
  Schema.Struct({ id: Schema.Number, value: Schema.Unknown }),
).pipe(
  Schema.decodeTo(
    Schema.ReadonlyMap(Schema.String, Schema.String),
    SchemaTransformation.transform<
      ReadonlyMap<string, string>,
      ReadonlyArray<{ readonly id: number; readonly value: unknown }>
    >({
      decode: (fields) =>
        new Map(
          fields.flatMap(({ id, value }) => fieldValue(value).map((text) => [String(id), text])),
        ),
      encode: (fields) => Array.from(fields, ([id, value]) => ({ id: Number(id), value })),
    }),
  ),
);

/** User and organization fields, as a map from field key to value. */
export const keyedCustomFields = Schema.Record(Schema.String, Schema.Unknown).pipe(
  Schema.decodeTo(
    Schema.ReadonlyMap(Schema.String, Schema.String),
    SchemaTransformation.transform<ReadonlyMap<string, string>, Readonly<Record<string, unknown>>>({
      decode: (fields) =>
        new Map(
          Object.entries(fields).flatMap(([key, value]) =>
            fieldValue(value).map((text) => [key, text]),
          ),
        ),
      encode: (fields) => Object.fromEntries(fields),
    }),
  ),
);
