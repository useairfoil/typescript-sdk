/** biome-ignore-all lint/suspicious/noExplicitAny: Effect Schema variance requires any. */
import { Schema } from "effect";

import type { TimeUnit } from "../cluster-schema/arrow-type";
import {
  WingsNullable,
  WingsType,
  type WingsTypeAnnotation,
} from "./wings-annotations";

/**
 * Attaches the internal Wings Arrow type annotation to a schema.
 */
const annotateWingsType = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  annotation: WingsTypeAnnotation,
): Schema.Schema<A, I, R> => schema.annotations({ [WingsType]: annotation });

/**
 * Wraps a schema to accept null values and marks the Wings Arrow field nullable.
 */
export const WingsNullOr = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
): Schema.Schema<A | null, I | null, R> => {
  const annotation = readWingsTypeAnnotation(schema);
  const nullOr = Schema.NullOr(schema);
  const existingAnnotations = readAnnotations(schema);
  const nextAnnotations: Record<symbol, unknown> = {
    ...existingAnnotations,
    [WingsNullable]: true,
  };
  if (annotation) {
    nextAnnotations[WingsType] = annotation;
  }
  return nullOr.annotations(nextAnnotations);
};

/**
 * Reads the Wings Arrow type annotation from a schema, if present.
 */
function readWingsTypeAnnotation(
  schema: Schema.Schema<any, any, any>,
): WingsTypeAnnotation | undefined {
  return readAnnotations(schema)[WingsType] as WingsTypeAnnotation | undefined;
}

/**
 * Reads the annotations map from a schema AST.
 */
function readAnnotations(
  schema: Schema.Schema<any, any, any>,
): Record<symbol, unknown> {
  const ast = schema.ast as { annotations?: Record<symbol, unknown> };
  return ast.annotations ?? {};
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
export const WingsBinary = annotateWingsType(Schema.Uint8ArrayFromSelf, {
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
export const WingsUInt64 = annotateWingsType(Schema.BigIntFromSelf, {
  _tag: "primitive",
  type: "uint64",
});

/** Arrow int64 schema. */
export const WingsInt64 = annotateWingsType(Schema.BigIntFromSelf, {
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
export const WingsList = <Item extends Schema.Schema<any, any, any>>(
  item: Item,
) =>
  annotateWingsType(Schema.Array(item), {
    _tag: "list",
    item,
  });

/**
 * Convenience alias for defining nested Wings structs.
 */
export const WingsStruct = Schema.Struct;
