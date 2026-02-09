import { Schema } from "effect";
import type * as Proto from "../proto/schema/arrow_type";
import { TimeUnit } from "../proto/schema/arrow_type";

export { TimeUnit };

/** A single field in an Arrow schema (recursive via ArrowType). */
export interface Field {
  readonly name: string;
  readonly id: bigint;
  readonly arrowType?: ArrowType | undefined;
  readonly nullable: boolean;
  readonly metadata: { readonly [x: string]: string };
}

/** Arrow List type – contains a single optional field definition (recursive). */
export interface List {
  readonly fieldType?: Field | undefined;
}

/** Arrow Struct type – contains an ordered list of sub-fields (recursive). */
export interface Struct {
  readonly subFieldTypes: ReadonlyArray<Field>;
}

/** Discriminated union of all Arrow data types. */
export type ArrowType =
  | { readonly _tag: "none" }
  | { readonly _tag: "bool" }
  | { readonly _tag: "uint8" }
  | { readonly _tag: "int8" }
  | { readonly _tag: "uint16" }
  | { readonly _tag: "int16" }
  | { readonly _tag: "uint32" }
  | { readonly _tag: "int32" }
  | { readonly _tag: "uint64" }
  | { readonly _tag: "int64" }
  | { readonly _tag: "float16" }
  | { readonly _tag: "float32" }
  | { readonly _tag: "float64" }
  | { readonly _tag: "utf8" }
  | { readonly _tag: "binary" }
  | { readonly _tag: "date32" }
  | { readonly _tag: "date64" }
  | { readonly _tag: "duration"; readonly duration: TimeUnit }
  | {
      readonly _tag: "timestamp";
      readonly timestamp: {
        readonly timeUnit: number;
        readonly timezone: string;
      };
    }
  | { readonly _tag: "list"; readonly list: List }
  | { readonly _tag: "struct"; readonly struct: Struct };

export const Timestamp = Schema.Struct({
  timeUnit: Schema.Enums(TimeUnit),
  timezone: Schema.String,
});

export type Timestamp = typeof Timestamp.Type;

export const List: Schema.Schema<List> = Schema.Struct({
  fieldType: Schema.optional(Schema.suspend((): Schema.Schema<Field> => Field)),
});

export const Struct: Schema.Schema<Struct> = Schema.Struct({
  subFieldTypes: Schema.Array(
    Schema.suspend((): Schema.Schema<Field> => Field),
  ),
});

export const ArrowType: Schema.Schema<ArrowType> = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal("none") }),
  Schema.Struct({ _tag: Schema.Literal("bool") }),
  Schema.Struct({ _tag: Schema.Literal("uint8") }),
  Schema.Struct({ _tag: Schema.Literal("int8") }),
  Schema.Struct({ _tag: Schema.Literal("uint16") }),
  Schema.Struct({ _tag: Schema.Literal("int16") }),
  Schema.Struct({ _tag: Schema.Literal("uint32") }),
  Schema.Struct({ _tag: Schema.Literal("int32") }),
  Schema.Struct({ _tag: Schema.Literal("uint64") }),
  Schema.Struct({ _tag: Schema.Literal("int64") }),
  Schema.Struct({ _tag: Schema.Literal("float16") }),
  Schema.Struct({ _tag: Schema.Literal("float32") }),
  Schema.Struct({ _tag: Schema.Literal("float64") }),
  Schema.Struct({ _tag: Schema.Literal("utf8") }),
  Schema.Struct({ _tag: Schema.Literal("binary") }),
  Schema.Struct({ _tag: Schema.Literal("date32") }),
  Schema.Struct({ _tag: Schema.Literal("date64") }),
  Schema.Struct({
    _tag: Schema.Literal("duration"),
    duration: Schema.Enums(TimeUnit),
  }),
  Schema.Struct({
    _tag: Schema.Literal("timestamp"),
    timestamp: Timestamp,
  }),
  Schema.Struct({
    _tag: Schema.Literal("list"),
    list: List,
  }),
  Schema.Struct({
    _tag: Schema.Literal("struct"),
    struct: Struct,
  }),
);

export const Field: Schema.Schema<Field> = Schema.Struct({
  name: Schema.String,
  id: Schema.BigIntFromSelf,
  arrowType: Schema.optional(ArrowType),
  nullable: Schema.Boolean,
  metadata: Schema.Record({ key: Schema.String, value: Schema.String }),
});

/** An Arrow schema – an ordered collection of fields with metadata. */
export const ArrowSchema = Schema.Struct({
  fields: Schema.Array(Field),
  metadata: Schema.Record({ key: Schema.String, value: Schema.String }),
});

export type ArrowSchema = typeof ArrowSchema.Type;

/** A serialized datum value with its Arrow type and binary content. */
export const Datum = Schema.Struct({
  type: Schema.optional(ArrowType),
  content: Schema.Uint8ArrayFromSelf,
});

export type Datum = typeof Datum.Type;

const EMPTY: Proto.EmptyMessage = {
  $type: "wings.schema.EmptyMessage",
};

function metadataToProto(metadata: {
  readonly [x: string]: string;
}): Map<string, string> {
  return new Map(Object.entries(metadata));
}

function metadataFromProto(metadata: Map<string, string>): {
  readonly [x: string]: string;
} {
  return Object.fromEntries(metadata);
}

function timestampToProto(value: Timestamp): Proto.Timestamp {
  return {
    $type: "wings.schema.Timestamp",
    timeUnit: value.timeUnit,
    timezone: value.timezone,
  };
}

function timestampFromProto(value: Proto.Timestamp): Timestamp {
  return {
    timeUnit: value.timeUnit,
    timezone: value.timezone,
  };
}

function listToProto(value: List): Proto.List {
  return {
    $type: "wings.schema.List",
    fieldType: value.fieldType ? fieldToProto(value.fieldType) : undefined,
  };
}

function listFromProto(value: Proto.List): List {
  return {
    fieldType: value.fieldType ? fieldFromProto(value.fieldType) : undefined,
  };
}

function structToProto(value: Struct): Proto.Struct {
  return {
    $type: "wings.schema.Struct",
    subFieldTypes: value.subFieldTypes.map(fieldToProto),
  };
}

function structFromProto(value: Proto.Struct): Struct {
  return {
    subFieldTypes: value.subFieldTypes.map(fieldFromProto),
  };
}

function fieldToProto(value: Field): Proto.Field {
  return {
    $type: "wings.schema.Field",
    name: value.name,
    id: value.id,
    arrowType: value.arrowType ? arrowTypeToProto(value.arrowType) : undefined,
    nullable: value.nullable,
    metadata: metadataToProto(value.metadata),
  };
}

function fieldFromProto(value: Proto.Field): Field {
  return {
    name: value.name,
    id: value.id,
    arrowType: value.arrowType
      ? arrowTypeFromProto(value.arrowType)
      : undefined,
    nullable: value.nullable,
    metadata: metadataFromProto(value.metadata),
  };
}

function arrowTypeToProto(value: ArrowType): Proto.ArrowType {
  const $type = "wings.schema.ArrowType" as const;
  switch (value._tag) {
    case "none":
      return { $type, arrowTypeEnum: { $case: "none", none: EMPTY } };
    case "bool":
      return { $type, arrowTypeEnum: { $case: "bool", bool: EMPTY } };
    case "uint8":
      return { $type, arrowTypeEnum: { $case: "uint8", uint8: EMPTY } };
    case "int8":
      return { $type, arrowTypeEnum: { $case: "int8", int8: EMPTY } };
    case "uint16":
      return { $type, arrowTypeEnum: { $case: "uint16", uint16: EMPTY } };
    case "int16":
      return { $type, arrowTypeEnum: { $case: "int16", int16: EMPTY } };
    case "uint32":
      return { $type, arrowTypeEnum: { $case: "uint32", uint32: EMPTY } };
    case "int32":
      return { $type, arrowTypeEnum: { $case: "int32", int32: EMPTY } };
    case "uint64":
      return { $type, arrowTypeEnum: { $case: "uint64", uint64: EMPTY } };
    case "int64":
      return { $type, arrowTypeEnum: { $case: "int64", int64: EMPTY } };
    case "float16":
      return { $type, arrowTypeEnum: { $case: "float16", float16: EMPTY } };
    case "float32":
      return { $type, arrowTypeEnum: { $case: "float32", float32: EMPTY } };
    case "float64":
      return { $type, arrowTypeEnum: { $case: "float64", float64: EMPTY } };
    case "utf8":
      return { $type, arrowTypeEnum: { $case: "utf8", utf8: EMPTY } };
    case "binary":
      return { $type, arrowTypeEnum: { $case: "binary", binary: EMPTY } };
    case "date32":
      return { $type, arrowTypeEnum: { $case: "date32", date32: EMPTY } };
    case "date64":
      return { $type, arrowTypeEnum: { $case: "date64", date64: EMPTY } };
    case "duration":
      return {
        $type,
        arrowTypeEnum: { $case: "duration", duration: value.duration },
      };
    case "timestamp":
      return {
        $type,
        arrowTypeEnum: {
          $case: "timestamp",
          timestamp: timestampToProto(value.timestamp),
        },
      };
    case "list":
      return {
        $type,
        arrowTypeEnum: {
          $case: "list",
          list: listToProto(value.list),
        },
      };
    case "struct":
      return {
        $type,
        arrowTypeEnum: {
          $case: "struct",
          struct: structToProto(value.struct),
        },
      };
  }
}

function arrowTypeFromProto(value: Proto.ArrowType): ArrowType {
  const e = value.arrowTypeEnum;
  if (!e) {
    throw new Error("ArrowType.arrowTypeEnum is undefined");
  }
  switch (e.$case) {
    case "none":
      return { _tag: "none" };
    case "bool":
      return { _tag: "bool" };
    case "uint8":
      return { _tag: "uint8" };
    case "int8":
      return { _tag: "int8" };
    case "uint16":
      return { _tag: "uint16" };
    case "int16":
      return { _tag: "int16" };
    case "uint32":
      return { _tag: "uint32" };
    case "int32":
      return { _tag: "int32" };
    case "uint64":
      return { _tag: "uint64" };
    case "int64":
      return { _tag: "int64" };
    case "float16":
      return { _tag: "float16" };
    case "float32":
      return { _tag: "float32" };
    case "float64":
      return { _tag: "float64" };
    case "utf8":
      return { _tag: "utf8" };
    case "binary":
      return { _tag: "binary" };
    case "date32":
      return { _tag: "date32" };
    case "date64":
      return { _tag: "date64" };
    case "duration":
      return { _tag: "duration", duration: e.duration };
    case "timestamp":
      return {
        _tag: "timestamp",
        timestamp: timestampFromProto(e.timestamp),
      };
    case "list":
      return { _tag: "list", list: listFromProto(e.list) };
    case "struct":
      return { _tag: "struct", struct: structFromProto(e.struct) };
  }
}

function schemaToProto(value: ArrowSchema): Proto.Schema {
  return {
    $type: "wings.schema.Schema",
    fields: value.fields.map(fieldToProto),
    metadata: metadataToProto(value.metadata),
  };
}

function schemaFromProto(value: Proto.Schema): ArrowSchema {
  return {
    fields: value.fields.map(fieldFromProto),
    metadata: metadataFromProto(value.metadata),
  };
}

function datumToProto(value: Datum): Proto.Datum {
  return {
    $type: "wings.schema.Datum",
    type: value.type ? arrowTypeToProto(value.type) : undefined,
    content: value.content,
  };
}

function datumFromProto(value: Proto.Datum): Datum {
  return {
    type: value.type ? arrowTypeFromProto(value.type) : undefined,
    content: value.content,
  };
}

export const Codec = {
  ArrowType: {
    toProto: arrowTypeToProto,
    fromProto: arrowTypeFromProto,
  },
  Field: {
    toProto: fieldToProto,
    fromProto: fieldFromProto,
  },
  Schema: {
    toProto: schemaToProto,
    fromProto: schemaFromProto,
  },
  Timestamp: {
    toProto: timestampToProto,
    fromProto: timestampFromProto,
  },
  List: {
    toProto: listToProto,
    fromProto: listFromProto,
  },
  Struct: {
    toProto: structToProto,
    fromProto: structFromProto,
  },
  Datum: {
    toProto: datumToProto,
    fromProto: datumFromProto,
  },
} as const;
