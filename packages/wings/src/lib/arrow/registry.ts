import {
  Type as ArrowTypesEnum,
  Binary,
  Bool,
  type DataType,
  type Date_,
  DateDay,
  DateMillisecond,
  Duration,
  DurationMicrosecond,
  DurationMillisecond,
  DurationNanosecond,
  DurationSecond,
  Field,
  type Float,
  Float16,
  Float32,
  Float64,
  type Int,
  Int8,
  Int16,
  Int32,
  Int64,
  List,
  Null,
  Schema,
  Struct,
  Timestamp,
  TimestampMicrosecond,
  TimestampMillisecond,
  TimestampNanosecond,
  TimestampSecond,
  Uint8,
  Uint16,
  Uint32,
  Uint64,
  Utf8,
} from "apache-arrow";
import { Schema as _Schema } from "apache-arrow/fb/schema";
import { toUint8Array } from "apache-arrow/util/buffer";
import * as flatbuffers from "flatbuffers";
import { FIELD_ID_METADATA_KEY } from "./arrow-type";
import type { FieldConfig } from "./schema";

/**
 * Custom error class for Arrow type creation failures
 */
export class ArrowTypeError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "ArrowTypeError";
  }
}

interface ArrowTypeEnumMap
  extends Record<FieldConfig["dataType"], ArrowTypesEnum> {
  Int8: ArrowTypesEnum.Int8;
  Int16: ArrowTypesEnum.Int16;
  Int32: ArrowTypesEnum.Int32;
  Int64: ArrowTypesEnum.Int64;
  Uint8: ArrowTypesEnum.Uint8;
  Uint16: ArrowTypesEnum.Uint16;
  Uint32: ArrowTypesEnum.Uint32;
  Uint64: ArrowTypesEnum.Uint64;
  Bool: ArrowTypesEnum.Bool;
  Utf8: ArrowTypesEnum.Utf8;
  Binary: ArrowTypesEnum.Binary;
  Null: ArrowTypesEnum.Null;
  Float16: ArrowTypesEnum.Float16;
  Float32: ArrowTypesEnum.Float32;
  Float64: ArrowTypesEnum.Float64;
  DateDay: ArrowTypesEnum.DateDay;
  DateMillisecond: ArrowTypesEnum.DateMillisecond;
  Duration: ArrowTypesEnum.Duration;
  DurationSecond: ArrowTypesEnum.DurationSecond;
  DurationMillisecond: ArrowTypesEnum.DurationMillisecond;
  DurationMicrosecond: ArrowTypesEnum.DurationMicrosecond;
  DurationNanosecond: ArrowTypesEnum.DurationNanosecond;
  Timestamp: ArrowTypesEnum.Timestamp;
  TimestampSecond: ArrowTypesEnum.TimestampSecond;
  TimestampMillisecond: ArrowTypesEnum.TimestampMillisecond;
  TimestampMicrosecond: ArrowTypesEnum.TimestampMicrosecond;
  TimestampNanosecond: ArrowTypesEnum.TimestampNanosecond;
  List: ArrowTypesEnum.List;
  Struct: ArrowTypesEnum.Struct;
}

type ArrowTypeRegistry = {
  [K in FieldConfig["dataType"]]: (
    fieldConfig: FieldConfig,
  ) => DataType<ArrowTypeEnumMap[K]>;
};

export const ARROW_TYPE_REGISTRY: ArrowTypeRegistry = {
  Int8: () => new Int8(),
  Int16: () => new Int16(),
  Int32: () => new Int32(),
  Int64: () => new Int64(),
  Uint8: () => new Uint8(),
  Uint16: () => new Uint16(),
  Uint32: () => new Uint32(),
  Uint64: () => new Uint64(),
  Bool: () => new Bool(),
  Utf8: () => new Utf8(),
  Binary: () => new Binary(),
  Null: () => new Null(),
  Float16: () => new Float16(),
  Float32: () => new Float32(),
  Float64: () => new Float64(),
  DateDay: () => new DateDay(),
  DateMillisecond: () => new DateMillisecond(),
  DurationSecond: () => new DurationSecond(),
  DurationMillisecond: () => new DurationMillisecond(),
  DurationMicrosecond: () => new DurationMicrosecond(),
  DurationNanosecond: () => new DurationNanosecond(),

  Duration: (fieldConfig) => {
    if (fieldConfig.dataType !== "Duration" || !fieldConfig.config) {
      throw new ArrowTypeError("[Duration] requires config with unit");
    }
    return new Duration(fieldConfig.config.unit);
  },

  Timestamp: (fieldConfig) => {
    if (fieldConfig.dataType !== "Timestamp" || !fieldConfig.config) {
      throw new ArrowTypeError(
        "[Timestamp] requires config with unit and timezone",
      );
    }
    return new Timestamp(fieldConfig.config.unit, fieldConfig.config.timezone);
  },

  TimestampSecond: (fieldConfig) => {
    const timezone =
      fieldConfig.dataType === "TimestampSecond" && fieldConfig.config?.timezone
        ? fieldConfig.config.timezone
        : null;
    return new TimestampSecond(timezone);
  },

  TimestampMillisecond: (fieldConfig) => {
    const timezone =
      fieldConfig.dataType === "TimestampMillisecond" &&
      fieldConfig.config?.timezone
        ? fieldConfig.config.timezone
        : null;
    return new TimestampMillisecond(timezone);
  },

  TimestampMicrosecond: (fieldConfig) => {
    const timezone =
      fieldConfig.dataType === "TimestampMicrosecond" &&
      fieldConfig.config?.timezone
        ? fieldConfig.config.timezone
        : null;
    return new TimestampMicrosecond(timezone);
  },

  TimestampNanosecond: (fieldConfig) => {
    const timezone =
      fieldConfig.dataType === "TimestampNanosecond" &&
      fieldConfig.config?.timezone
        ? fieldConfig.config.timezone
        : null;
    return new TimestampNanosecond(timezone);
  },

  Struct: (fieldConfig) => {
    if (fieldConfig.dataType !== "Struct" || !fieldConfig.config) {
      throw new ArrowTypeError("[Struct] requires config with children");
    }

    const fields = fieldConfig.config.children.map(createArrowField);
    return new Struct(fields);
  },

  List: (fieldConfig) => {
    if (fieldConfig.dataType !== "List" || !fieldConfig.config) {
      throw new ArrowTypeError("[List] requires config with child");
    }

    const { child } = fieldConfig.config;
    const elementField = createArrowField(child);
    return new List(elementField);
  },
};

/**
 * Gets all supported Arrow types from the registry
 */
export function getSupportedArrowTypes(): string[] {
  return Object.keys(ARROW_TYPE_REGISTRY);
}

/**
 * Checks if a type is supported by the registry
 */
export function isArrowTypeSupported(type: string): boolean {
  return type in ARROW_TYPE_REGISTRY;
}

/**
 * Converts a typeId to a type name
 * @param typeId - The typeId to convert
 * @returns The type name
 * @example
 * typeIdToTypeName[-2] // "Int8"
 */
export const typeIdToTypeName: Record<number, FieldConfig["dataType"]> = {
  [ArrowTypesEnum.Int8]: "Int8",
  [ArrowTypesEnum.Int16]: "Int16",
  [ArrowTypesEnum.Int32]: "Int32",
  [ArrowTypesEnum.Int64]: "Int64",
  [ArrowTypesEnum.Uint8]: "Uint8",
  [ArrowTypesEnum.Uint16]: "Uint16",
  [ArrowTypesEnum.Uint32]: "Uint32",
  [ArrowTypesEnum.Uint64]: "Uint64",
  [ArrowTypesEnum.Bool]: "Bool",
  [ArrowTypesEnum.Utf8]: "Utf8",
  [ArrowTypesEnum.Binary]: "Binary",
  [ArrowTypesEnum.Null]: "Null",
  [ArrowTypesEnum.Float16]: "Float16",
  [ArrowTypesEnum.Float32]: "Float32",
  [ArrowTypesEnum.Float64]: "Float64",
  [ArrowTypesEnum.DateDay]: "DateDay",
  [ArrowTypesEnum.DateMillisecond]: "DateMillisecond",
  [ArrowTypesEnum.Duration]: "Duration",
  [ArrowTypesEnum.DurationSecond]: "DurationSecond",
  [ArrowTypesEnum.DurationMillisecond]: "DurationMillisecond",
  [ArrowTypesEnum.DurationMicrosecond]: "DurationMicrosecond",
  [ArrowTypesEnum.DurationNanosecond]: "DurationNanosecond",
  [ArrowTypesEnum.Timestamp]: "Timestamp",
  [ArrowTypesEnum.TimestampSecond]: "TimestampSecond",
  [ArrowTypesEnum.TimestampMillisecond]: "TimestampMillisecond",
  [ArrowTypesEnum.TimestampMicrosecond]: "TimestampMicrosecond",
  [ArrowTypesEnum.TimestampNanosecond]: "TimestampNanosecond",
  [ArrowTypesEnum.List]: "List",
  [ArrowTypesEnum.Struct]: "Struct",
};

/**
 * Converts a field config to an Apache Arrow DataType using the type registry
 * @param fieldConfig - The field configuration containing type and configuration
 * @returns Arrow DataType instance
 * @throws ArrowTypeError if the type is not supported or creation fails
 */
export function createArrowDataType<
  T extends FieldConfig,
  K extends T["dataType"],
>(fieldConfig: T): DataType<ArrowTypeEnumMap[K]> {
  const factory = ARROW_TYPE_REGISTRY[fieldConfig.dataType];

  if (!factory) {
    throw new ArrowTypeError(
      `Unsupported Arrow type: ${fieldConfig.dataType} | Supported types: ${Object.keys(ARROW_TYPE_REGISTRY).join(", ")}`,
    );
  }

  try {
    return factory(fieldConfig) as DataType<ArrowTypeEnumMap[K]>;
  } catch (error) {
    throw new ArrowTypeError(
      `Failed to create Arrow type ${fieldConfig.dataType}`,
      error,
    );
  }
}

/**
 * Checks if a field is of a specific type
 * @param field - The field to check
 * @returns True if the field is of the specified type, false otherwise
 */
export const checkIsFieldType = {
  isInt8: (field: Field): field is Field<Int8> =>
    field.type.typeId === ArrowTypesEnum.Int8,
  isInt16: (field: Field): field is Field<Int16> =>
    field.type.typeId === ArrowTypesEnum.Int16,
  isInt32: (field: Field): field is Field<Int32> =>
    field.type.typeId === ArrowTypesEnum.Int32,
  isInt64: (field: Field): field is Field<Int64> =>
    field.type.typeId === ArrowTypesEnum.Int64,
  isUint8: (field: Field): field is Field<Uint8> =>
    field.type.typeId === ArrowTypesEnum.Uint8,
  isUint16: (field: Field): field is Field<Uint16> =>
    field.type.typeId === ArrowTypesEnum.Uint16,
  isUint32: (field: Field): field is Field<Uint32> =>
    field.type.typeId === ArrowTypesEnum.Uint32,
  isUint64: (field: Field): field is Field<Uint64> =>
    field.type.typeId === ArrowTypesEnum.Uint64,
  isBool: (field: Field): field is Field<Bool> =>
    field.type.typeId === ArrowTypesEnum.Bool,
  isUtf8: (field: Field): field is Field<Utf8> =>
    field.type.typeId === ArrowTypesEnum.Utf8,
  isBinary: (field: Field): field is Field<Binary> =>
    field.type.typeId === ArrowTypesEnum.Binary,
  isNull: (field: Field): field is Field<Null> =>
    field.type.typeId === ArrowTypesEnum.Null,
  isFloat16: (field: Field): field is Field<Float16> =>
    field.type.typeId === ArrowTypesEnum.Float16,
  isFloat32: (field: Field): field is Field<Float32> =>
    field.type.typeId === ArrowTypesEnum.Float32,
  isFloat64: (field: Field): field is Field<Float64> =>
    field.type.typeId === ArrowTypesEnum.Float64,
  isDateDay: (field: Field): field is Field<DateDay> =>
    field.type.typeId === ArrowTypesEnum.DateDay,
  isDateMillisecond: (field: Field): field is Field<DateMillisecond> =>
    field.type.typeId === ArrowTypesEnum.DateMillisecond,
  isDuration: (field: Field): field is Field<Duration> =>
    field.type.typeId === ArrowTypesEnum.Duration,
  isDurationSecond: (field: Field): field is Field<DurationSecond> =>
    field.type.typeId === ArrowTypesEnum.DurationSecond,
  isDurationMillisecond: (field: Field): field is Field<DurationMillisecond> =>
    field.type.typeId === ArrowTypesEnum.DurationMillisecond,
  isDurationMicrosecond: (field: Field): field is Field<DurationMicrosecond> =>
    field.type.typeId === ArrowTypesEnum.DurationMicrosecond,
  isDurationNanosecond: (field: Field): field is Field<DurationNanosecond> =>
    field.type.typeId === ArrowTypesEnum.DurationNanosecond,
  isTimestamp: (field: Field): field is Field<Timestamp> =>
    field.type.typeId === ArrowTypesEnum.Timestamp,
  isTimestampSecond: (field: Field): field is Field<TimestampSecond> =>
    field.type.typeId === ArrowTypesEnum.TimestampSecond,
  isTimestampMillisecond: (
    field: Field,
  ): field is Field<TimestampMillisecond> =>
    field.type.typeId === ArrowTypesEnum.TimestampMillisecond,
  isTimestampMicrosecond: (
    field: Field,
  ): field is Field<TimestampMicrosecond> =>
    field.type.typeId === ArrowTypesEnum.TimestampMicrosecond,
  isTimestampNanosecond: (field: Field): field is Field<TimestampNanosecond> =>
    field.type.typeId === ArrowTypesEnum.TimestampNanosecond,
  isList: (field: Field): field is Field<List> =>
    field.type.typeId === ArrowTypesEnum.List,
  isStruct: (field: Field): field is Field<Struct> =>
    field.type.typeId === ArrowTypesEnum.Struct,
} satisfies Record<`is${FieldConfig["dataType"]}`, (field: Field) => boolean>;

/**
 * Gets the type name of a Field as a string literal
 * @param field
 * @returns The type name and corresponding strongly typed field
 */
export function getFieldType(field: Field) {
  switch (field.type.typeId as ArrowTypesEnum) {
    case ArrowTypesEnum.Int8:
      return { type: "Int8" as const, field: field as Field<Int8> };
    case ArrowTypesEnum.Int16:
      return { type: "Int16" as const, field: field as Field<Int16> };
    case ArrowTypesEnum.Int32:
      return { type: "Int32" as const, field: field as Field<Int32> };
    case ArrowTypesEnum.Int64:
      return { type: "Int64" as const, field: field as Field<Int64> };
    case ArrowTypesEnum.Uint8:
      return { type: "Uint8" as const, field: field as Field<Uint8> };
    case ArrowTypesEnum.Uint16:
      return { type: "Uint16" as const, field: field as Field<Uint16> };
    case ArrowTypesEnum.Uint32:
      return { type: "Uint32" as const, field: field as Field<Uint32> };
    case ArrowTypesEnum.Uint64:
      return { type: "Uint64" as const, field: field as Field<Uint64> };
    case ArrowTypesEnum.Bool:
      return { type: "Bool" as const, field: field as Field<Bool> };
    case ArrowTypesEnum.Utf8:
      return { type: "Utf8" as const, field: field as Field<Utf8> };
    case ArrowTypesEnum.Binary:
      return { type: "Binary" as const, field: field as Field<Binary> };
    case ArrowTypesEnum.Null:
      return { type: "Null" as const, field: field as Field<Null> };
    case ArrowTypesEnum.Float16:
      return { type: "Float16" as const, field: field as Field<Float16> };
    case ArrowTypesEnum.Float32:
      return { type: "Float32" as const, field: field as Field<Float32> };
    case ArrowTypesEnum.Float64:
      return { type: "Float64" as const, field: field as Field<Float64> };
    case ArrowTypesEnum.DateDay:
      return { type: "DateDay" as const, field: field as Field<DateDay> };
    case ArrowTypesEnum.DateMillisecond:
      return {
        type: "DateMillisecond" as const,
        field: field as Field<DateMillisecond>,
      };
    case ArrowTypesEnum.Duration:
      return { type: "Duration" as const, field: field as Field<Duration> };
    case ArrowTypesEnum.DurationSecond:
      return {
        type: "DurationSecond" as const,
        field: field as Field<DurationSecond>,
      };
    case ArrowTypesEnum.DurationMillisecond:
      return {
        type: "DurationMillisecond" as const,
        field: field as Field<DurationMillisecond>,
      };
    case ArrowTypesEnum.DurationMicrosecond:
      return {
        type: "DurationMicrosecond" as const,
        field: field as Field<DurationMicrosecond>,
      };
    case ArrowTypesEnum.DurationNanosecond:
      return {
        type: "DurationNanosecond" as const,
        field: field as Field<DurationNanosecond>,
      };
    case ArrowTypesEnum.Timestamp:
      return { type: "Timestamp" as const, field: field as Field<Timestamp> };
    case ArrowTypesEnum.TimestampSecond:
      return {
        type: "TimestampSecond" as const,
        field: field as Field<TimestampSecond>,
      };
    case ArrowTypesEnum.TimestampMillisecond:
      return {
        type: "TimestampMillisecond" as const,
        field: field as Field<TimestampMillisecond>,
      };
    case ArrowTypesEnum.TimestampMicrosecond:
      return {
        type: "TimestampMicrosecond" as const,
        field: field as Field<TimestampMicrosecond>,
      };
    case ArrowTypesEnum.TimestampNanosecond:
      return {
        type: "TimestampNanosecond" as const,
        field: field as Field<TimestampNanosecond>,
      };
    case ArrowTypesEnum.List:
      return { type: "List" as const, field: field as Field<List> };
    case ArrowTypesEnum.Struct:
      return { type: "Struct" as const, field: field as Field<Struct> };
    default:
      throw new ArrowTypeError(`Unsupported field type: ${field.type.typeId}`);
  }
}

/**
 * Converts a field config to an Apache Arrow Field
 */
export function createArrowField(fieldConfig: FieldConfig): Field {
  const dataType = createArrowDataType(fieldConfig);
  const metadata = new Map<string, string>();

  const ARROW_TYPE_METADATA_KEY = "wings.arrow_type";
  const explicitArrowTypes = new Set<FieldConfig["dataType"]>([
    "DurationSecond",
    "DurationMillisecond",
    "DurationMicrosecond",
    "DurationNanosecond",
    "TimestampSecond",
    "TimestampMillisecond",
    "TimestampMicrosecond",
    "TimestampNanosecond",
  ]);

  if (fieldConfig.description) {
    metadata.set("description", fieldConfig.description);
  }

  if (explicitArrowTypes.has(fieldConfig.dataType)) {
    metadata.set(ARROW_TYPE_METADATA_KEY, fieldConfig.dataType);
  }

  metadata.set(FIELD_ID_METADATA_KEY, fieldConfig.id.toString());

  return new Field(fieldConfig.name, dataType, fieldConfig.nullable, metadata);
}
/**
 * Converts an array of field configs to an Apache Arrow Schema and serializes it to bytes using flatbuffers
 */
export function serializeFieldsToSchemaBytes(
  fields: readonly FieldConfig[] | FieldConfig[],
): Uint8Array {
  const arrowFields = fields.map(createArrowField);
  const schema = new Schema(arrowFields);
  const builder = new flatbuffers.Builder();
  const schemaOffset = Schema.encode(builder, schema);
  builder.finish(schemaOffset);
  return builder.asUint8Array();
}

/**
 * Deserializes an Apache Arrow Schema from bytes using flatbuffers
 * @param bytes - The bytes to deserialize
 * @returns The deserialized Apache Arrow Schema
 */
export function deserializeSchemaBytesToSchema(bytes: Uint8Array): Schema {
  const byteBuffer = new flatbuffers.ByteBuffer(toUint8Array(bytes));
  const _schema = _Schema.getRootAsSchema(byteBuffer);
  return Schema.decode(_schema);
}

/**
 * Converts an Apache Arrow Field back to a FieldConfig
 * This is the reverse of createArrowField
 */
export function arrowFieldToFieldConfig(field: Field): FieldConfig {
  const description = field.metadata.get("description");
  const idMetadata = field.metadata.get(FIELD_ID_METADATA_KEY);
  if (!idMetadata) {
    throw new ArrowTypeError(`Missing field id metadata for ${field.name}`);
  }
  const id = BigInt(idMetadata);
  const explicitArrowType = field.metadata.get("wings.arrow_type");
  const baseField = {
    name: field.name,
    nullable: field.nullable,
    id,
    ...(description ? { description } : {}),
  };

  if (explicitArrowType) {
    switch (explicitArrowType) {
      case "DurationSecond":
      case "DurationMillisecond":
      case "DurationMicrosecond":
      case "DurationNanosecond":
        return { ...baseField, dataType: explicitArrowType };
      case "TimestampSecond":
      case "TimestampMillisecond":
      case "TimestampMicrosecond":
      case "TimestampNanosecond": {
        const tsType = field.type as Timestamp;
        return {
          ...baseField,
          dataType: explicitArrowType,
          ...(tsType.timezone ? { config: { timezone: tsType.timezone } } : {}),
        };
      }
    }
  }

  const type = field.type;
  const typeId = type.typeId as ArrowTypesEnum;

  switch (typeId) {
    case ArrowTypesEnum.Int: {
      const intType = type as Int;
      switch (intType.bitWidth) {
        case 8:
          return {
            ...baseField,
            dataType: intType.isSigned ? "Int8" : "Uint8",
          };
        case 16:
          return {
            ...baseField,
            dataType: intType.isSigned ? "Int16" : "Uint16",
          };
        case 32:
          return {
            ...baseField,
            dataType: intType.isSigned ? "Int32" : "Uint32",
          };
        case 64:
          return {
            ...baseField,
            dataType: intType.isSigned ? "Int64" : "Uint64",
          };
        default:
          throw new ArrowTypeError(
            `Unsupported integer bit width: ${intType.bitWidth}`,
          );
      }
    }
    case ArrowTypesEnum.Float: {
      const floatType = type as Float;
      switch (floatType.precision) {
        case 0:
          return { ...baseField, dataType: "Float16" };
        case 1:
          return { ...baseField, dataType: "Float32" };
        case 2:
          return { ...baseField, dataType: "Float64" };
        default:
          throw new ArrowTypeError(
            `Unsupported float precision: ${floatType.precision}`,
          );
      }
    }
    case ArrowTypesEnum.Date: {
      const dateType = type as Date_;
      return {
        ...baseField,
        dataType: dateType.unit === 0 ? "DateDay" : "DateMillisecond",
      };
    }
    case ArrowTypesEnum.Int8:
      return { ...baseField, dataType: "Int8" };
    case ArrowTypesEnum.Int16:
      return { ...baseField, dataType: "Int16" };
    case ArrowTypesEnum.Int32:
      return { ...baseField, dataType: "Int32" };
    case ArrowTypesEnum.Int64:
      return { ...baseField, dataType: "Int64" };
    case ArrowTypesEnum.Uint8:
      return { ...baseField, dataType: "Uint8" };
    case ArrowTypesEnum.Uint16:
      return { ...baseField, dataType: "Uint16" };
    case ArrowTypesEnum.Uint32:
      return { ...baseField, dataType: "Uint32" };
    case ArrowTypesEnum.Uint64:
      return { ...baseField, dataType: "Uint64" };
    case ArrowTypesEnum.Bool:
      return { ...baseField, dataType: "Bool" };
    case ArrowTypesEnum.Utf8:
      return { ...baseField, dataType: "Utf8" };
    case ArrowTypesEnum.Binary:
      return { ...baseField, dataType: "Binary" };
    case ArrowTypesEnum.Null:
      return { ...baseField, dataType: "Null" };
    case ArrowTypesEnum.Float16:
      return { ...baseField, dataType: "Float16" };
    case ArrowTypesEnum.Float32:
      return { ...baseField, dataType: "Float32" };
    case ArrowTypesEnum.Float64:
      return { ...baseField, dataType: "Float64" };
    case ArrowTypesEnum.DateDay:
      return { ...baseField, dataType: "DateDay" };
    case ArrowTypesEnum.DateMillisecond:
      return { ...baseField, dataType: "DateMillisecond" };
    case ArrowTypesEnum.DurationSecond:
      return { ...baseField, dataType: "DurationSecond" };
    case ArrowTypesEnum.DurationMillisecond:
      return { ...baseField, dataType: "DurationMillisecond" };
    case ArrowTypesEnum.DurationMicrosecond:
      return { ...baseField, dataType: "DurationMicrosecond" };
    case ArrowTypesEnum.DurationNanosecond:
      return { ...baseField, dataType: "DurationNanosecond" };
    case ArrowTypesEnum.Duration: {
      const durationType = type as Duration;
      return {
        ...baseField,
        dataType: "Duration",
        config: { unit: durationType.unit },
      };
    }
    case ArrowTypesEnum.Timestamp: {
      const tsType = type as Timestamp;
      return {
        ...baseField,
        dataType: "Timestamp",
        config: {
          unit: tsType.unit,
          ...(tsType.timezone ? { timezone: tsType.timezone } : {}),
        },
      };
    }
    case ArrowTypesEnum.TimestampSecond: {
      const tsType = type as TimestampSecond;
      return {
        ...baseField,
        dataType: "TimestampSecond",
        ...(tsType.timezone ? { config: { timezone: tsType.timezone } } : {}),
      };
    }
    case ArrowTypesEnum.TimestampMillisecond: {
      const tsType = type as TimestampMillisecond;
      return {
        ...baseField,
        dataType: "TimestampMillisecond",
        ...(tsType.timezone ? { config: { timezone: tsType.timezone } } : {}),
      };
    }
    case ArrowTypesEnum.TimestampMicrosecond: {
      const tsType = type as TimestampMicrosecond;
      return {
        ...baseField,
        dataType: "TimestampMicrosecond",
        ...(tsType.timezone ? { config: { timezone: tsType.timezone } } : {}),
      };
    }
    case ArrowTypesEnum.TimestampNanosecond: {
      const tsType = type as TimestampNanosecond;
      return {
        ...baseField,
        dataType: "TimestampNanosecond",
        ...(tsType.timezone ? { config: { timezone: tsType.timezone } } : {}),
      };
    }

    case ArrowTypesEnum.List: {
      const listType = type as List;
      const childField = listType.children[0];
      return {
        ...baseField,
        dataType: "List",
        config: { child: arrowFieldToFieldConfig(childField) },
      };
    }

    case ArrowTypesEnum.Struct: {
      const structType = type as Struct;
      return {
        ...baseField,
        dataType: "Struct",
        config: { children: structType.children.map(arrowFieldToFieldConfig) },
      };
    }

    default:
      throw new ArrowTypeError(
        `Unsupported Arrow type for deserialization: ${typeId}`,
      );
  }
}

/**
 * Deserializes schema bytes to an array of FieldConfigs
 * This is the reverse of serializeFieldsToSchemaBytes
 */
export function deserializeSchemaBytesToFieldConfigs(
  bytes: Uint8Array,
): FieldConfig[] {
  const schema = deserializeSchemaBytesToSchema(bytes);
  return schema.fields.map(arrowFieldToFieldConfig);
}
