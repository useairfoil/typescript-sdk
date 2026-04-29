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
export const WingsNullOr = <A>(schema: Schema.Schema<A>): Schema.Schema<A | null> => {
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
export const WingsString = annotateWingsType(Schema.String, {
  _tag: "primitive",
  type: "utf8",
});

/** Arrow boolean schema. */
export const WingsBool = annotateWingsType(Schema.Boolean, {
  _tag: "primitive",
  type: "bool",
});

/** Arrow binary schema. */
export const WingsBinary = annotateWingsType(Schema.Uint8Array, {
  _tag: "primitive",
  type: "binary",
});

/** Arrow uint8 schema. */
export const WingsUInt8 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "uint8",
});

/** Arrow int8 schema. */
export const WingsInt8 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "int8",
});

/** Arrow uint16 schema. */
export const WingsUInt16 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "uint16",
});

/** Arrow int16 schema. */
export const WingsInt16 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "int16",
});

/** Arrow uint32 schema. */
export const WingsUInt32 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "uint32",
});

/** Arrow int32 schema. */
export const WingsInt32 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "int32",
});

/** Arrow uint64 schema. */
export const WingsUInt64 = annotateWingsType(Schema.BigInt, {
  _tag: "primitive",
  type: "uint64",
});

/** Arrow int64 schema. */
export const WingsInt64 = annotateWingsType(Schema.BigInt, {
  _tag: "primitive",
  type: "int64",
});

/** Arrow float16 schema. */
export const WingsFloat16 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "float16",
});

/** Arrow float32 schema. */
export const WingsFloat32 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "float32",
});

/** Arrow float64 schema. */
export const WingsFloat64 = annotateWingsType(Schema.Number, {
  _tag: "primitive",
  type: "float64",
});

/** Arrow date32 schema. */
export const WingsDate32 = annotateWingsType(Schema.Date, {
  _tag: "primitive",
  type: "date32",
});

/** Arrow date64 schema. */
export const WingsDate64 = annotateWingsType(Schema.Date, {
  _tag: "primitive",
  type: "date64",
});

/** Arrow timestamp schema with time unit and timezone. */
export const WingsTimestamp = (timeUnit: TimeUnit, timezone?: string) =>
  annotateWingsType(Schema.Date, {
    _tag: "timestamp",
    timeUnit,
    timezone,
  });

/** Arrow duration schema with time unit. */
export const WingsDuration = (timeUnit: TimeUnit) =>
  annotateWingsType(Schema.Number, {
    _tag: "duration",
    timeUnit,
  });

/**
 * Arrow list schema with a single item field definition.
 * The item schema must include a FieldId annotation.
 */
export const WingsList = <Item extends Schema.Top>(item: Item) =>
  annotateWingsType(Schema.Array(item), {
    _tag: "list",
    item,
  });

/**
 * Convenience alias for defining nested Wings structs.
 */
export const WingsStruct = Schema.Struct;

export const Types = {
  Binary: WingsBinary,
  Bool: WingsBool,
  Date32: WingsDate32,
  Date64: WingsDate64,
  Duration: WingsDuration,
  Float16: WingsFloat16,
  Float32: WingsFloat32,
  Float64: WingsFloat64,
  Int8: WingsInt8,
  Int16: WingsInt16,
  Int32: WingsInt32,
  Int64: WingsInt64,
  List: WingsList,
  NullOr: WingsNullOr,
  String: WingsString,
  Struct: WingsStruct,
  Timestamp: WingsTimestamp,
  UInt8: WingsUInt8,
  UInt16: WingsUInt16,
  UInt32: WingsUInt32,
  UInt64: WingsUInt64,
} as const;
