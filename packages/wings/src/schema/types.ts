import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";

import type { TimeUnit } from "../cluster/arrow-type";

import { WingsNullable, WingsType, type WingsTypeAnnotation } from "./annotations";

/**
 * Attaches the internal Wings Arrow type annotation to a schema.
 */
const annotateWingsType = <A>(
  schema: Schema.Schema<A>,
  annotation: WingsTypeAnnotation,
): Schema.Schema<A> => schema.annotate({ [WingsType]: annotation });

/**
 * Wraps a schema to accept null values and marks the Wings Arrow field nullable.
 */
export const NullOr = <A>(schema: Schema.Schema<A>): Schema.Schema<A | null> => {
  const existingAnnotations = (SchemaAST.resolve(schema.ast) ?? {}) as Record<PropertyKey, unknown>;
  const nullOr = Schema.NullOr(schema);
  const nextAnnotations: Record<PropertyKey, unknown> = {
    ...existingAnnotations,
    [WingsNullable]: true,
  };
  return nullOr.annotate(nextAnnotations);
};

/**
 * Reads the Wings Arrow type annotation from a schema, if present.
 */
function _readWingsTypeAnnotation(schema: Schema.Top): WingsTypeAnnotation | undefined {
  const annotations = (SchemaAST.resolve(schema.ast) ?? {}) as Record<PropertyKey, unknown>;
  return annotations[WingsType] as WingsTypeAnnotation | undefined;
}

/** Arrow UTF-8 string schema. */
export const String = annotateWingsType(Schema.String, {
  _tag: "primitive",
  type: "utf8",
});

/** Arrow boolean schema. */
export const Bool = annotateWingsType(Schema.Boolean, {
  _tag: "primitive",
  type: "bool",
});

/** Arrow binary schema. */
export const Binary = annotateWingsType(Schema.Uint8Array, {
  _tag: "primitive",
  type: "binary",
});

/** Arrow uint8 schema. */
export const UInt8 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "uint8",
});

/** Arrow int8 schema. */
export const Int8 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "int8",
});

/** Arrow uint16 schema. */
export const UInt16 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "uint16",
});

/** Arrow int16 schema. */
export const Int16 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "int16",
});

/** Arrow uint32 schema. */
export const UInt32 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "uint32",
});

/** Arrow int32 schema. */
export const Int32 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "int32",
});

/** Arrow uint64 schema. */
export const UInt64 = annotateWingsType(Schema.BigInt, {
  _tag: "primitive",
  type: "uint64",
});

/** Arrow int64 schema. */
export const Int64 = annotateWingsType(Schema.BigInt, {
  _tag: "primitive",
  type: "int64",
});

/** Arrow float16 schema. */
export const Float16 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "float16",
});

/** Arrow float32 schema. */
export const Float32 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "float32",
});

/** Arrow float64 schema. */
export const Float64 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "float64",
});

/** Arrow date32 schema. */
export const Date32 = annotateWingsType(Schema.Date, {
  _tag: "primitive",
  type: "date32",
});

/** Arrow date64 schema. */
export const Date64 = annotateWingsType(Schema.Date, {
  _tag: "primitive",
  type: "date64",
});

/** Arrow timestamp schema with time unit and timezone. */
export const Timestamp = (timeUnit: TimeUnit, timezone?: string) =>
  annotateWingsType(Schema.Date, {
    _tag: "timestamp",
    timeUnit,
    timezone,
  });

/** Arrow duration schema with time unit. */
export const Duration = (timeUnit: TimeUnit) =>
  annotateWingsType(Schema.Number, {
    _tag: "duration",
    timeUnit,
  });

/**
 * Arrow list schema with a single item field definition.
 * The item schema must include a FieldId annotation.
 */
export const List = <Item extends Schema.Top>(item: Item) =>
  annotateWingsType(Schema.Array(item), {
    _tag: "list",
    item,
  });

/**
 * Convenience alias for defining nested Wings structs.
 */
export const Struct = Schema.Struct;

export const Types = {
  Binary,
  Bool,
  Date32,
  Date64,
  Duration,
  Float16,
  Float32,
  Float64,
  Int8,
  Int16,
  Int32,
  Int64,
  List,
  NullOr,
  String,
  Struct,
  Timestamp,
  UInt8,
  UInt16,
  UInt32,
  UInt64,
} as const;
