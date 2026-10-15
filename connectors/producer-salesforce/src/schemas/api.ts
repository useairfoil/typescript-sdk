import { Schema } from "effect";

import { Timestamp } from "./shared";

/** One object from `GET /sobjects`. */
export const GlobalObjectSchema = Schema.Struct({
  name: Schema.String,
  custom: Schema.Boolean,
  queryable: Schema.Boolean,
  replicateable: Schema.Boolean,
});

export const GlobalDescribeSchema = Schema.Struct({ sobjects: Schema.Array(GlobalObjectSchema) });

export const PicklistValueSchema = Schema.Struct({
  value: Schema.String,
  label: Schema.NullOr(Schema.String),
  active: Schema.Boolean,
});

export const DescribeFieldSchema = Schema.Struct({
  name: Schema.String,
  label: Schema.String,
  type: Schema.String,
  custom: Schema.Boolean,
  calculated: Schema.Boolean,
  nillable: Schema.Boolean,
  length: Schema.Int,
  precision: Schema.Int,
  scale: Schema.Int,
  referenceTo: Schema.Array(Schema.String),
  picklistValues: Schema.Array(PicklistValueSchema),
});

export type DescribeField = Schema.Schema.Type<typeof DescribeFieldSchema>;

/** `GET /sobjects/{object}/describe`. */
export const DescribeSchema = Schema.Struct({
  replicateable: Schema.Boolean,
  fields: Schema.Array(DescribeFieldSchema),
});

/** A `queryAll` page of IDs. */
export const IdQuerySchema = Schema.Struct({
  done: Schema.Boolean,
  records: Schema.Array(Schema.Struct({ Id: Schema.String })),
});

export const UpdatedSchema = Schema.Struct({
  ids: Schema.Array(Schema.String),
  latestDateCovered: Schema.DateTimeUtcFromString,
});

export const DeletedSchema = Schema.Struct({
  deletedRecords: Schema.Array(Schema.Struct({ id: Schema.String })),
  latestDateCovered: Schema.DateTimeUtcFromString,
});

// Every record has `attributes`. Compound and binary fields are never asked
// for, so any other object value fails to decode.
const FieldValueSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Struct({ type: Schema.String, url: Schema.String }),
]);

export const RecordSchema = Schema.StructWithRest(Schema.Struct({ Id: Schema.String }), [
  Schema.Record(Schema.String, FieldValueSchema),
]);

export type SalesforceRecord = Schema.Schema.Type<typeof RecordSchema>;

/** Records from the collections read. Deleted or hidden IDs are `null`. */
export const RecordListSchema = Schema.Array(Schema.NullOr(RecordSchema));

/** The audit times, for objects that have them. */
export const RecordTimesSchema = Schema.Struct({
  CreatedDate: Schema.optional(Timestamp),
  SystemModstamp: Schema.optional(Timestamp),
});
