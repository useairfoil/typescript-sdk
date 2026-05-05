import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

import type * as Proto from "../proto/schema/arrow_type";

import { WingsDecodeError } from "../errors";
import { TimeUnit } from "../proto/schema/arrow_type";

export { TimeUnit };

// Domain schemas

export const Timestamp = Schema.Struct({
  timeUnit: Schema.Enum(TimeUnit),
  timezone: Schema.String,
});
export type Timestamp = typeof Timestamp.Type;

/** Arrow list type. */
export class List extends Schema.Opaque<List>()(
  Schema.Struct({
    fieldType: Schema.optional(Schema.suspend((): Schema.Codec<Field> => Field)),
  }),
) {}

/** Arrow struct type. */
export class Struct extends Schema.Opaque<Struct>()(
  Schema.Struct({
    subFieldTypes: Schema.Array(Schema.suspend((): Schema.Codec<Field> => Field)),
  }),
) {}

/** Arrow field. */
export class Field extends Schema.Opaque<Field>()(
  Schema.Struct({
    name: Schema.String,
    id: Schema.BigInt,
    arrowType: Schema.optional(Schema.suspend((): Schema.Codec<ArrowType> => ArrowType)),
    nullable: Schema.Boolean,
    metadata: Schema.Record(Schema.String, Schema.String),
  }),
) {}

/** Arrow data types. */
export const ArrowType = Schema.Union([
  Schema.TaggedStruct("none", {}),
  Schema.TaggedStruct("bool", {}),
  Schema.TaggedStruct("uint8", {}),
  Schema.TaggedStruct("int8", {}),
  Schema.TaggedStruct("uint16", {}),
  Schema.TaggedStruct("int16", {}),
  Schema.TaggedStruct("uint32", {}),
  Schema.TaggedStruct("int32", {}),
  Schema.TaggedStruct("uint64", {}),
  Schema.TaggedStruct("int64", {}),
  Schema.TaggedStruct("float16", {}),
  Schema.TaggedStruct("float32", {}),
  Schema.TaggedStruct("float64", {}),
  Schema.TaggedStruct("utf8", {}),
  Schema.TaggedStruct("binary", {}),
  Schema.TaggedStruct("date32", {}),
  Schema.TaggedStruct("date64", {}),
  Schema.TaggedStruct("duration", { duration: Schema.Enum(TimeUnit) }),
  Schema.TaggedStruct("timestamp", { timestamp: Timestamp }),
  Schema.TaggedStruct("list", { list: List }),
  Schema.TaggedStruct("struct", { struct: Struct }),
]);
export type ArrowType = typeof ArrowType.Type;

/** Arrow schema. */
export const ArrowSchema = Schema.Struct({
  fields: Schema.Array(Field),
  metadata: Schema.Record(Schema.String, Schema.String),
});
export type ArrowSchema = typeof ArrowSchema.Type;

/** Datum payload. */
export const Datum = Schema.Struct({
  type: Schema.UndefinedOr(ArrowType),
  content: Schema.Uint8Array,
});
export type Datum = typeof Datum.Type;

// Proto schemas

const EmptyProto: Schema.Codec<Proto.EmptyMessage> = Schema.Struct({
  $type: Schema.Literal("wings.schema.EmptyMessage"),
});

const TimestampProto: Schema.Codec<Proto.Timestamp> = Schema.Struct({
  $type: Schema.Literal("wings.schema.Timestamp"),
  timeUnit: Schema.Enum(TimeUnit),
  timezone: Schema.String,
});

const ListProto: Schema.Codec<Proto.List> = Schema.Struct({
  $type: Schema.Literal("wings.schema.List"),
  fieldType: Schema.UndefinedOr(Schema.suspend((): Schema.Codec<Proto.Field> => FieldProto)),
});

const StructProto: Schema.Codec<Proto.Struct> = Schema.Struct({
  $type: Schema.Literal("wings.schema.Struct"),
  subFieldTypes: Schema.Array(Schema.suspend((): Schema.Codec<Proto.Field> => FieldProto)),
});

const ArrowTypeEnumProto = Schema.Union([
  Schema.Struct({ $case: Schema.Literal("none"), none: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("bool"), bool: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("uint8"), uint8: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("int8"), int8: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("uint16"), uint16: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("int16"), int16: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("uint32"), uint32: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("int32"), int32: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("uint64"), uint64: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("int64"), int64: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("float16"), float16: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("float32"), float32: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("float64"), float64: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("utf8"), utf8: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("binary"), binary: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("date32"), date32: EmptyProto }),
  Schema.Struct({ $case: Schema.Literal("date64"), date64: EmptyProto }),
  Schema.Struct({
    $case: Schema.Literal("duration"),
    duration: Schema.Enum(TimeUnit),
  }),
  Schema.Struct({
    $case: Schema.Literal("timestamp"),
    timestamp: TimestampProto,
  }),
  Schema.Struct({ $case: Schema.Literal("list"), list: ListProto }),
  Schema.Struct({ $case: Schema.Literal("struct"), struct: StructProto }),
]);

const ArrowTypeProto: Schema.Codec<Proto.ArrowType> = Schema.Struct({
  $type: Schema.Literal("wings.schema.ArrowType"),
  arrowTypeEnum: Schema.optional(ArrowTypeEnumProto),
});

// metadata is a Map, so we keep Schema.Any as Schema.Map does not exist in effect.
const FieldProto = Schema.Struct({
  $type: Schema.Literal("wings.schema.Field"),
  name: Schema.String,
  id: Schema.BigInt,
  arrowType: Schema.UndefinedOr(ArrowTypeProto),
  nullable: Schema.Boolean,
  metadata: Schema.Any,
});

const ArrowSchemaProto = Schema.Struct({
  $type: Schema.Literal("wings.schema.Schema"),
  fields: Schema.Array(FieldProto),
  metadata: Schema.Any,
});

const DatumProto: Schema.Codec<Proto.Datum> = Schema.Struct({
  $type: Schema.Literal("wings.schema.Datum"),
  type: Schema.UndefinedOr(ArrowTypeProto),
  content: Schema.Uint8Array,
});

// Transforms

function metadataToProto(metadata: { readonly [x: string]: string }): Map<string, string> {
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
  return { timeUnit: value.timeUnit, timezone: value.timezone };
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
  return { subFieldTypes: value.subFieldTypes.map(fieldFromProto) };
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
    arrowType: value.arrowType ? arrowTypeFromProto(value.arrowType) : undefined,
    nullable: value.nullable,
    metadata: metadataFromProto(value.metadata),
  };
}

const EMPTY: Proto.EmptyMessage = { $type: "wings.schema.EmptyMessage" };

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
        arrowTypeEnum: { $case: "list", list: listToProto(value.list) },
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
  if (!e) throw new WingsDecodeError("ArrowType.arrowTypeEnum is undefined");
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

// Codecs

const TimestampCodec = TimestampProto.pipe(
  Schema.decodeTo(
    Timestamp,
    SchemaTransformation.transform({
      decode: timestampFromProto,
      encode: timestampToProto,
    }),
  ),
);

const ListCodec = ListProto.pipe(
  Schema.decodeTo(
    List,
    SchemaTransformation.transform({
      decode: listFromProto,
      encode: listToProto,
    }),
  ),
);

const StructCodec = StructProto.pipe(
  Schema.decodeTo(
    Struct,
    SchemaTransformation.transform({
      decode: structFromProto,
      encode: structToProto,
    }),
  ),
);

const ArrowTypeCodec = ArrowTypeProto.pipe(
  Schema.decodeTo(
    ArrowType,
    SchemaTransformation.transform({
      decode: arrowTypeFromProto,
      encode: arrowTypeToProto,
    }),
  ),
);

const FieldCodec = FieldProto.pipe(
  Schema.decodeTo(
    Field,
    SchemaTransformation.transform({
      decode: (proto) => fieldFromProto(proto),
      encode: fieldToProto,
    }),
  ),
);

const ArrowSchemaCodec = ArrowSchemaProto.pipe(
  Schema.decodeTo(
    ArrowSchema,
    SchemaTransformation.transform({
      decode: (proto): ArrowSchema => ({
        fields: proto.fields.map((f) => fieldFromProto(f)),
        metadata: metadataFromProto(proto.metadata),
      }),
      encode: (domain): typeof ArrowSchemaProto.Type => ({
        $type: "wings.schema.Schema" as const,
        fields: Array.from(domain.fields.map(fieldToProto)),
        metadata: metadataToProto(domain.metadata),
      }),
    }),
  ),
);

const DatumCodec = DatumProto.pipe(
  Schema.decodeTo(
    Datum,
    SchemaTransformation.transform({
      decode: (proto) => ({
        type: proto.type ? arrowTypeFromProto(proto.type) : undefined,
        content: proto.content,
      }),
      encode: (domain) => ({
        $type: "wings.schema.Datum" as const,
        type: domain.type ? arrowTypeToProto(domain.type) : undefined,
        content: domain.content,
      }),
    }),
  ),
);

export const Codec = {
  Timestamp: {
    toProto: Schema.encodeSync(TimestampCodec),
    fromProto: Schema.decodeSync(TimestampCodec),
  },

  List: {
    toProto: Schema.encodeSync(ListCodec),
    fromProto: Schema.decodeSync(ListCodec),
  },

  Struct: {
    toProto: Schema.encodeSync(StructCodec),
    fromProto: Schema.decodeSync(StructCodec),
  },

  ArrowType: {
    toProto: Schema.encodeSync(ArrowTypeCodec),
    fromProto: Schema.decodeSync(ArrowTypeCodec),
  },

  Field: {
    toProto: Schema.encodeSync(FieldCodec),
    fromProto: Schema.decodeSync(FieldCodec),
  },

  ArrowSchema: {
    toProto: Schema.encodeSync(ArrowSchemaCodec),
    fromProto: Schema.decodeSync(ArrowSchemaCodec),
  },

  Datum: {
    toProto: Schema.encodeSync(DatumCodec),
    fromProto: Schema.decodeSync(DatumCodec),
  },
} as const;
