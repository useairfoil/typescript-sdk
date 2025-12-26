import {
  Type as ArrowTypesEnum,
  Binary,
  Bool,
  type DataType,
  Date_,
  DateDay,
  DateMillisecond,
  Decimal,
  DenseUnion,
  Dictionary,
  Duration,
  DurationMicrosecond,
  DurationMillisecond,
  DurationNanosecond,
  DurationSecond,
  Field,
  FixedSizeBinary,
  FixedSizeList,
  Float,
  Float16,
  Float32,
  Float64,
  Int,
  Int8,
  Int16,
  Int32,
  Int64,
  Interval,
  IntervalDayTime,
  IntervalMonthDayNano,
  IntervalYearMonth,
  LargeBinary,
  LargeUtf8,
  List,
  Map_,
  Null,
  Schema,
  SparseUnion,
  Struct,
  Time,
  TimeMicrosecond,
  TimeMillisecond,
  TimeNanosecond,
  TimeSecond,
  Timestamp,
  TimestampMicrosecond,
  TimestampMillisecond,
  TimestampNanosecond,
  TimestampSecond,
  Uint8,
  Uint16,
  Uint32,
  Uint64,
  Union,
  Utf8,
} from "apache-arrow";
import { Schema as _Schema } from "apache-arrow/fb/schema";
import type { TKeys } from "apache-arrow/type";
import { toUint8Array } from "apache-arrow/util/buffer";
import * as flatbuffers from "flatbuffers";
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
  Int: ArrowTypesEnum.Int;
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
  Float: ArrowTypesEnum.Float;
  Float16: ArrowTypesEnum.Float16;
  Float32: ArrowTypesEnum.Float32;
  Float64: ArrowTypesEnum.Float64;
  LargeUtf8: ArrowTypesEnum.LargeUtf8;
  LargeBinary: ArrowTypesEnum.LargeBinary;
  Date: ArrowTypesEnum.Date;
  DateDay: ArrowTypesEnum.DateDay;
  DateMillisecond: ArrowTypesEnum.DateMillisecond;
  Time: ArrowTypesEnum.Time;
  TimeSecond: ArrowTypesEnum.TimeSecond;
  TimeMillisecond: ArrowTypesEnum.TimeMillisecond;
  TimeMicrosecond: ArrowTypesEnum.TimeMicrosecond;
  TimeNanosecond: ArrowTypesEnum.TimeNanosecond;
  Duration: ArrowTypesEnum.Duration;
  DurationSecond: ArrowTypesEnum.DurationSecond;
  DurationMillisecond: ArrowTypesEnum.DurationMillisecond;
  DurationMicrosecond: ArrowTypesEnum.DurationMicrosecond;
  DurationNanosecond: ArrowTypesEnum.DurationNanosecond;
  Interval: ArrowTypesEnum.Interval;
  IntervalDayTime: ArrowTypesEnum.IntervalDayTime;
  IntervalYearMonth: ArrowTypesEnum.IntervalYearMonth;
  IntervalMonthDayNano: ArrowTypesEnum.IntervalMonthDayNano;
  FixedSizeBinary: ArrowTypesEnum.FixedSizeBinary;
  Timestamp: ArrowTypesEnum.Timestamp;
  TimestampMillisecond: ArrowTypesEnum.TimestampMillisecond;
  TimestampMicrosecond: ArrowTypesEnum.TimestampMicrosecond;
  TimestampNanosecond: ArrowTypesEnum.TimestampNanosecond;
  Decimal: ArrowTypesEnum.Decimal;
  TimestampSecond: ArrowTypesEnum.TimestampSecond;
  List: ArrowTypesEnum.List;
  FixedSizeList: ArrowTypesEnum.FixedSizeList;
  Struct: ArrowTypesEnum.Struct;
  Dictionary: ArrowTypesEnum.Dictionary;
  Union: ArrowTypesEnum.Union;
  DenseUnion: ArrowTypesEnum.DenseUnion;
  SparseUnion: ArrowTypesEnum.SparseUnion;
  Map: ArrowTypesEnum.Map;
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
  LargeUtf8: () => new LargeUtf8(),
  LargeBinary: () => new LargeBinary(),
  DateDay: () => new DateDay(),
  DateMillisecond: () => new DateMillisecond(),
  TimeSecond: () => new TimeSecond(),
  TimeMillisecond: () => new TimeMillisecond(),
  TimeMicrosecond: () => new TimeMicrosecond(),
  TimeNanosecond: () => new TimeNanosecond(),
  DurationSecond: () => new DurationSecond(),
  DurationMillisecond: () => new DurationMillisecond(),
  DurationMicrosecond: () => new DurationMicrosecond(),
  DurationNanosecond: () => new DurationNanosecond(),
  IntervalDayTime: () => new IntervalDayTime(),
  IntervalYearMonth: () => new IntervalYearMonth(),
  IntervalMonthDayNano: () => new IntervalMonthDayNano(),

  // Types with configurations
  Int: (fieldConfig) => {
    if (fieldConfig.dataType !== "Int" || !fieldConfig.config) {
      throw new ArrowTypeError(
        "[Int] requires config with isSigned and bitWidth",
      );
    }
    return new Int(fieldConfig.config.isSigned, fieldConfig.config.bitWidth);
  },

  Float: (fieldConfig) => {
    if (fieldConfig.dataType !== "Float" || !fieldConfig.config) {
      throw new ArrowTypeError("[Float] requires config with precision");
    }
    return new Float(fieldConfig.config.precision);
  },

  Date: (fieldConfig) => {
    if (fieldConfig.dataType !== "Date" || !fieldConfig.config) {
      throw new ArrowTypeError("[Date] requires config with unit");
    }
    return new Date_(fieldConfig.config.unit);
  },

  Time: (fieldConfig) => {
    if (fieldConfig.dataType !== "Time" || !fieldConfig.config) {
      throw new ArrowTypeError("[Time] requires config with unit and bitWidth");
    }
    return new Time(fieldConfig.config.unit, fieldConfig.config.bitWidth);
  },

  Duration: (fieldConfig) => {
    if (fieldConfig.dataType !== "Duration" || !fieldConfig.config) {
      throw new ArrowTypeError("[Duration] requires config with unit");
    }
    return new Duration(fieldConfig.config.unit);
  },

  Interval: (fieldConfig) => {
    if (fieldConfig.dataType !== "Interval" || !fieldConfig.config) {
      throw new ArrowTypeError("[Interval] requires config with unit");
    }
    return new Interval(fieldConfig.config.unit);
  },

  FixedSizeBinary: (fieldConfig) => {
    if (fieldConfig.dataType !== "FixedSizeBinary" || !fieldConfig.config) {
      throw new ArrowTypeError(
        "[FixedSizeBinary] requires config with byteWidth",
      );
    }
    return new FixedSizeBinary(fieldConfig.config.byteWidth);
  },

  FixedSizeList: (fieldConfig) => {
    if (fieldConfig.dataType !== "FixedSizeList" || !fieldConfig.config) {
      throw new ArrowTypeError(
        "[FixedSizeList] requires config with listSize and elementType",
      );
    }

    const { child } = fieldConfig.config;
    const elementField = new Field(
      child.name,
      createArrowDataType(child),
      child.nullable,
      child.description
        ? new Map([["description", child.description]])
        : new Map(),
    );
    return new FixedSizeList(fieldConfig.config.listSize, elementField);
  },

  Decimal: (fieldConfig) => {
    if (fieldConfig.dataType !== "Decimal" || !fieldConfig.config) {
      throw new ArrowTypeError(
        "Decimal requires config with precision, scale, and bitWidth",
      );
    }
    return new Decimal(
      fieldConfig.config.scale,
      fieldConfig.config.precision,
      fieldConfig.config.bitWidth,
    );
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

  Dictionary: (fieldConfig) => {
    if (fieldConfig.dataType !== "Dictionary" || !fieldConfig.config) {
      throw new ArrowTypeError(
        "[Dictionary] requires config with dictionary and indices",
      );
    }
    const indicesType = fieldConfig.config.indices.dataType;
    if (
      indicesType !== "Int8" &&
      indicesType !== "Int16" &&
      indicesType !== "Int32" &&
      indicesType !== "Uint8" &&
      indicesType !== "Uint16" &&
      indicesType !== "Uint32"
    ) {
      throw new ArrowTypeError(
        "[Dictionary] Indices must be Int8, Int16, Int32, Uint8, Uint16, or Uint32",
      );
    }

    const dictionaryField = createArrowDataType(fieldConfig.config.dictionary);
    const indicesField = createArrowDataType(
      fieldConfig.config.indices,
    ) as TKeys;

    return new Dictionary(
      dictionaryField,
      indicesField,
      fieldConfig.config.id,
      fieldConfig.config.isOrdered ?? false,
    );
  },

  Struct: (fieldConfig) => {
    if (fieldConfig.dataType !== "Struct" || !fieldConfig.config) {
      throw new ArrowTypeError("[Struct] requires config with children");
    }

    const fields = fieldConfig.config.children.map(
      (child) =>
        new Field(
          child.name,
          createArrowDataType(child),
          child.nullable,
          child.description
            ? new Map([["description", child.description]])
            : new Map(),
        ),
    );

    return new Struct(fields);
  },

  List: (fieldConfig) => {
    if (fieldConfig.dataType !== "List" || !fieldConfig.config) {
      throw new ArrowTypeError("[List] requires config with child");
    }

    const { child } = fieldConfig.config;
    const elementField = new Field(
      child.name,
      createArrowDataType(child),
      child.nullable,
      child.description
        ? new Map([["description", child.description]])
        : new Map(),
    );

    return new List(elementField);
  },

  Map: (fieldConfig) => {
    if (fieldConfig.dataType !== "Map" || !fieldConfig.config) {
      throw new ArrowTypeError("[Map] requires config with entries");
    }

    const { key: keyChild, value: valueChild } = fieldConfig.config.entries;

    const keyField = new Field(
      keyChild.name,
      createArrowDataType(keyChild),
      keyChild.nullable,
      keyChild.description
        ? new Map([["description", keyChild.description]])
        : new Map(),
    );

    const valueField = new Field(
      valueChild.name,
      createArrowDataType(valueChild),
      valueChild.nullable,
      valueChild.description
        ? new Map([["description", valueChild.description]])
        : new Map(),
    );

    const entriesField = new Field(
      fieldConfig.name,
      new Struct([keyField, valueField]),
      fieldConfig.nullable,
      fieldConfig.description
        ? new Map([["description", fieldConfig.description]])
        : new Map(),
    );
    return new Map_(entriesField, fieldConfig.config.keysSorted);
  },

  Union: (fieldConfig) => {
    if (fieldConfig.dataType !== "Union" || !fieldConfig.config) {
      throw new ArrowTypeError("[Union] requires config with mode and typeIds");
    }
    const children = fieldConfig.config.children.map(
      (child) =>
        new Field(
          child.name,
          createArrowDataType(child),
          child.nullable,
          child.description
            ? new Map([["description", child.description]])
            : new Map(),
        ),
    );

    return new Union(
      fieldConfig.config.mode,
      fieldConfig.config.typeIds,
      children,
    );
  },

  DenseUnion: (fieldConfig) => {
    if (fieldConfig.dataType !== "DenseUnion" || !fieldConfig.config) {
      throw new ArrowTypeError(
        "[DenseUnion] requires config with typeIds and children",
      );
    }

    const children = fieldConfig.config.children.map(
      (child) =>
        new Field(
          child.name,
          createArrowDataType(child),
          child.nullable,
          child.description
            ? new Map([["description", child.description]])
            : new Map(),
        ),
    );

    return new DenseUnion(fieldConfig.config.typeIds, children);
  },

  SparseUnion: (fieldConfig) => {
    if (fieldConfig.dataType !== "SparseUnion" || !fieldConfig.config) {
      throw new ArrowTypeError(
        "[SparseUnion] requires config with typeIds and children",
      );
    }

    const children = fieldConfig.config.children.map(
      (child) =>
        new Field(
          child.name,
          createArrowDataType(child),
          child.nullable,
          child.description
            ? new Map([["description", child.description]])
            : new Map(),
        ),
    );

    return new SparseUnion(fieldConfig.config.typeIds, children);
  },
} as const;

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
export const typeIdToTypeName: Record<number, FieldConfig["dataType"]> =
  Object.fromEntries(
    Object.entries(ArrowTypesEnum).map(([key, value]) => [
      value as number,
      key as FieldConfig["dataType"],
    ]),
  );

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
  isInt: (field: Field): field is Field<Int> =>
    field.type.typeId === ArrowTypesEnum.Int,
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
  isFloat: (field: Field): field is Field<Float> =>
    field.type.typeId === ArrowTypesEnum.Float,
  isFloat16: (field: Field): field is Field<Float16> =>
    field.type.typeId === ArrowTypesEnum.Float16,
  isFloat32: (field: Field): field is Field<Float32> =>
    field.type.typeId === ArrowTypesEnum.Float32,
  isFloat64: (field: Field): field is Field<Float64> =>
    field.type.typeId === ArrowTypesEnum.Float64,
  isLargeUtf8: (field: Field): field is Field<LargeUtf8> =>
    field.type.typeId === ArrowTypesEnum.LargeUtf8,
  isLargeBinary: (field: Field): field is Field<LargeBinary> =>
    field.type.typeId === ArrowTypesEnum.LargeBinary,
  isDate: (field: Field): field is Field<Date_> =>
    field.type.typeId === ArrowTypesEnum.Date,
  isDateDay: (field: Field): field is Field<DateDay> =>
    field.type.typeId === ArrowTypesEnum.DateDay,
  isDateMillisecond: (field: Field): field is Field<DateMillisecond> =>
    field.type.typeId === ArrowTypesEnum.DateMillisecond,
  isTime: (field: Field): field is Field<Time> =>
    field.type.typeId === ArrowTypesEnum.Time,
  isTimeSecond: (field: Field): field is Field<TimeSecond> =>
    field.type.typeId === ArrowTypesEnum.TimeSecond,
  isTimeMillisecond: (field: Field): field is Field<TimeMillisecond> =>
    field.type.typeId === ArrowTypesEnum.TimeMillisecond,
  isTimeMicrosecond: (field: Field): field is Field<TimeMicrosecond> =>
    field.type.typeId === ArrowTypesEnum.TimeMicrosecond,
  isTimeNanosecond: (field: Field): field is Field<TimeNanosecond> =>
    field.type.typeId === ArrowTypesEnum.TimeNanosecond,
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
  isInterval: (field: Field): field is Field<Interval> =>
    field.type.typeId === ArrowTypesEnum.Interval,
  isIntervalDayTime: (field: Field): field is Field<IntervalDayTime> =>
    field.type.typeId === ArrowTypesEnum.IntervalDayTime,
  isIntervalYearMonth: (field: Field): field is Field<IntervalYearMonth> =>
    field.type.typeId === ArrowTypesEnum.IntervalYearMonth,
  isIntervalMonthDayNano: (
    field: Field,
  ): field is Field<IntervalMonthDayNano> =>
    field.type.typeId === ArrowTypesEnum.IntervalMonthDayNano,
  isFixedSizeBinary: (field: Field): field is Field<FixedSizeBinary> =>
    field.type.typeId === ArrowTypesEnum.FixedSizeBinary,
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
  isDecimal: (field: Field): field is Field<Decimal> =>
    field.type.typeId === ArrowTypesEnum.Decimal,
  isTimestamp: (field: Field): field is Field<Timestamp> =>
    field.type.typeId === ArrowTypesEnum.Timestamp,
  isTimestampSecond: (field: Field): field is Field<TimestampSecond> =>
    field.type.typeId === ArrowTypesEnum.TimestampSecond,
  isList: (field: Field): field is Field<List> =>
    field.type.typeId === ArrowTypesEnum.List,
  isFixedSizeList: (field: Field): field is Field<FixedSizeList> =>
    field.type.typeId === ArrowTypesEnum.FixedSizeList,
  isStruct: (field: Field): field is Field<Struct> =>
    field.type.typeId === ArrowTypesEnum.Struct,
  isDictionary: (field: Field): field is Field<Dictionary> =>
    field.type.typeId === ArrowTypesEnum.Dictionary,
  isUnion: (field: Field): field is Field<Union> =>
    field.type.typeId === ArrowTypesEnum.Union,
  isDenseUnion: (field: Field): field is Field<DenseUnion> =>
    field.type.typeId === ArrowTypesEnum.DenseUnion,
  isSparseUnion: (field: Field): field is Field<SparseUnion> =>
    field.type.typeId === ArrowTypesEnum.SparseUnion,
  isMap: (field: Field): field is Field<Map_> =>
    field.type.typeId === ArrowTypesEnum.Map,
} satisfies Record<`is${FieldConfig["dataType"]}`, (field: Field) => boolean>;

/**
 * Gets the type name of a Field as a string literal
 * @param field
 * @returns The type name and corresponding strongly typed field
 */
export function getFieldType(field: Field) {
  switch (field.type.typeId as ArrowTypesEnum) {
    case ArrowTypesEnum.Int:
      return {
        type: "Int" as const,
        field: field as Field<Int>,
      };
    case ArrowTypesEnum.Int8:
      return {
        type: "Int8" as const,
        field: field as Field<Int8>,
      };
    case ArrowTypesEnum.Int16:
      return {
        type: "Int16" as const,
        field: field as Field<Int16>,
      };
    case ArrowTypesEnum.Int32:
      return {
        type: "Int32" as const,
        field: field as Field<Int32>,
      };
    case ArrowTypesEnum.Int64:
      return {
        type: "Int64" as const,
        field: field as Field<Int64>,
      };
    case ArrowTypesEnum.Uint8:
      return {
        type: "Uint8" as const,
        field: field as Field<Uint8>,
      };
    case ArrowTypesEnum.Uint16:
      return {
        type: "Uint16" as const,
        field: field as Field<Uint16>,
      };
    case ArrowTypesEnum.Uint32:
      return {
        type: "Uint32" as const,
        field: field as Field<Uint32>,
      };
    case ArrowTypesEnum.Uint64:
      return {
        type: "Uint64" as const,
        field: field as Field<Uint64>,
      };
    case ArrowTypesEnum.Bool:
      return {
        type: "Bool" as const,
        field: field as Field<Bool>,
      };
    case ArrowTypesEnum.Utf8:
      return {
        type: "Utf8" as const,
        field: field as Field<Utf8>,
      };
    case ArrowTypesEnum.Binary:
      return {
        type: "Binary" as const,
        field: field as Field<Binary>,
      };
    case ArrowTypesEnum.Null:
      return {
        type: "Null" as const,
        field: field as Field<Null>,
      };
    case ArrowTypesEnum.Float:
      return {
        type: "Float" as const,
        field: field as Field<Float>,
      };
    case ArrowTypesEnum.Float16:
      return {
        type: "Float16" as const,
        field: field as Field<Float16>,
      };
    case ArrowTypesEnum.Float32:
      return {
        type: "Float32" as const,
        field: field as Field<Float32>,
      };
    case ArrowTypesEnum.Float64:
      return {
        type: "Float64" as const,
        field: field as Field<Float64>,
      };
    case ArrowTypesEnum.LargeUtf8:
      return {
        type: "LargeUtf8" as const,
        field: field as Field<LargeUtf8>,
      };
    case ArrowTypesEnum.LargeBinary:
      return {
        type: "LargeBinary" as const,
        field: field as Field<LargeBinary>,
      };
    case ArrowTypesEnum.Date:
      return {
        type: "Date" as const,
        field: field as Field<Date_>,
      };
    case ArrowTypesEnum.DateDay:
      return {
        type: "DateDay" as const,
        field: field as Field<DateDay>,
      };
    case ArrowTypesEnum.DateMillisecond:
      return {
        type: "DateMillisecond" as const,
        field: field as Field<DateMillisecond>,
      };
    case ArrowTypesEnum.Time:
      return {
        type: "Time" as const,
        field: field as Field<Time>,
      };
    case ArrowTypesEnum.TimeSecond:
      return {
        type: "TimeSecond" as const,
        field: field as Field<TimeSecond>,
      };
    case ArrowTypesEnum.TimeMillisecond:
      return {
        type: "TimeMillisecond" as const,
        field: field as Field<TimeMillisecond>,
      };
    case ArrowTypesEnum.TimeMicrosecond:
      return {
        type: "TimeMicrosecond" as const,
        field: field as Field<TimeMicrosecond>,
      };
    case ArrowTypesEnum.TimeNanosecond:
      return {
        type: "TimeNanosecond" as const,
        field: field as Field<TimeNanosecond>,
      };
    case ArrowTypesEnum.Duration:
      return {
        type: "Duration" as const,
        field: field as Field<Duration>,
      };
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
    case ArrowTypesEnum.Interval:
      return {
        type: "Interval" as const,
        field: field as Field<Interval>,
      };
    case ArrowTypesEnum.IntervalDayTime:
      return {
        type: "IntervalDayTime" as const,
        field: field as Field<IntervalDayTime>,
      };
    case ArrowTypesEnum.IntervalYearMonth:
      return {
        type: "IntervalYearMonth" as const,
        field: field as Field<IntervalYearMonth>,
      };
    case ArrowTypesEnum.IntervalMonthDayNano:
      return {
        type: "IntervalMonthDayNano" as const,
        field: field as Field<IntervalMonthDayNano>,
      };
    case ArrowTypesEnum.FixedSizeBinary:
      return {
        type: "FixedSizeBinary" as const,
        field: field as Field<FixedSizeBinary>,
      };
    case ArrowTypesEnum.Timestamp:
      return {
        type: "Timestamp" as const,
        field: field as Field<Timestamp>,
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
    case ArrowTypesEnum.Decimal:
      return {
        type: "Decimal" as const,
        field: field as Field<Decimal>,
      };
    case ArrowTypesEnum.TimestampSecond:
      return {
        type: "TimestampSecond" as const,
        field: field as Field<TimestampSecond>,
      };
    case ArrowTypesEnum.List:
      return {
        type: "List" as const,
        field: field as Field<List>,
      };
    case ArrowTypesEnum.FixedSizeList:
      return {
        type: "FixedSizeList" as const,
        field: field as Field<FixedSizeList>,
      };
    case ArrowTypesEnum.Struct:
      return {
        type: "Struct" as const,
        field: field as Field<Struct>,
      };
    case ArrowTypesEnum.Dictionary:
      return {
        type: "Dictionary" as const,
        field: field as Field<Dictionary>,
      };
    case ArrowTypesEnum.Union:
      return {
        type: "Union" as const,
        field: field as Field<Union>,
      };
    case ArrowTypesEnum.DenseUnion:
      return {
        type: "DenseUnion" as const,
        field: field as Field<DenseUnion>,
      };
    case ArrowTypesEnum.SparseUnion:
      return {
        type: "SparseUnion" as const,
        field: field as Field<SparseUnion>,
      };
    case ArrowTypesEnum.Map:
      return {
        type: "Map" as const,
        field: field as Field<Map_>,
      };
    default:
      throw new ArrowTypeError(`Unsupported field type: ${field.type.typeId}`);
  }
}

/**
 * Converts a field config to an Apache Arrow Field
 */
export function createArrowField(fieldConfig: FieldConfig): Field {
  const dataType = createArrowDataType(fieldConfig);

  return new Field(
    fieldConfig.name,
    dataType,
    fieldConfig.nullable,
    fieldConfig.description
      ? new Map([["description", fieldConfig.description]])
      : new Map(),
  );
}

/**
 * Converts an array of field configs to an Apache Arrow Schema and serializes it to bytes using flatbuffers
 */
export function serializeFieldsToSchemaBytes(
  fields: FieldConfig[],
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
  const baseField = {
    name: field.name,
    nullable: field.nullable,
    ...(description ? { description } : {}),
  };

  const type = field.type;
  const typeId = type.typeId as ArrowTypesEnum;

  switch (typeId) {
    // Simple types without config
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
    case ArrowTypesEnum.LargeUtf8:
      return { ...baseField, dataType: "LargeUtf8" };
    case ArrowTypesEnum.LargeBinary:
      return { ...baseField, dataType: "LargeBinary" };
    case ArrowTypesEnum.DateDay:
      return { ...baseField, dataType: "DateDay" };
    case ArrowTypesEnum.DateMillisecond:
      return { ...baseField, dataType: "DateMillisecond" };
    case ArrowTypesEnum.TimeSecond:
      return { ...baseField, dataType: "TimeSecond" };
    case ArrowTypesEnum.TimeMillisecond:
      return { ...baseField, dataType: "TimeMillisecond" };
    case ArrowTypesEnum.TimeMicrosecond:
      return { ...baseField, dataType: "TimeMicrosecond" };
    case ArrowTypesEnum.TimeNanosecond:
      return { ...baseField, dataType: "TimeNanosecond" };
    case ArrowTypesEnum.DurationSecond:
      return { ...baseField, dataType: "DurationSecond" };
    case ArrowTypesEnum.DurationMillisecond:
      return { ...baseField, dataType: "DurationMillisecond" };
    case ArrowTypesEnum.DurationMicrosecond:
      return { ...baseField, dataType: "DurationMicrosecond" };
    case ArrowTypesEnum.DurationNanosecond:
      return { ...baseField, dataType: "DurationNanosecond" };
    case ArrowTypesEnum.IntervalDayTime:
      return { ...baseField, dataType: "IntervalDayTime" };
    case ArrowTypesEnum.IntervalYearMonth:
      return { ...baseField, dataType: "IntervalYearMonth" };
    case ArrowTypesEnum.IntervalMonthDayNano:
      return { ...baseField, dataType: "IntervalMonthDayNano" };

    // Types with config
    case ArrowTypesEnum.Int: {
      const intType = type as Int;
      return {
        ...baseField,
        dataType: "Int",
        config: {
          isSigned: intType.isSigned,
          bitWidth: intType.bitWidth,
        },
      };
    }

    case ArrowTypesEnum.Float: {
      const floatType = type as Float;
      return {
        ...baseField,
        dataType: "Float",
        config: { precision: floatType.precision },
      };
    }

    case ArrowTypesEnum.Date: {
      const dateType = type as Date_;
      return {
        ...baseField,
        dataType: "Date",
        config: { unit: dateType.unit },
      };
    }

    case ArrowTypesEnum.Time: {
      const timeType = type as Time;
      return {
        ...baseField,
        dataType: "Time",
        config: {
          unit: timeType.unit,
          bitWidth: timeType.bitWidth,
        },
      };
    }

    case ArrowTypesEnum.Duration: {
      const durationType = type as Duration;
      return {
        ...baseField,
        dataType: "Duration",
        config: { unit: durationType.unit },
      };
    }

    case ArrowTypesEnum.Interval: {
      const intervalType = type as Interval;
      return {
        ...baseField,
        dataType: "Interval",
        config: { unit: intervalType.unit },
      };
    }

    case ArrowTypesEnum.FixedSizeBinary: {
      const fsbType = type as FixedSizeBinary;
      return {
        ...baseField,
        dataType: "FixedSizeBinary",
        config: { byteWidth: fsbType.byteWidth },
      };
    }

    case ArrowTypesEnum.Decimal: {
      const decimalType = type as Decimal;
      return {
        ...baseField,
        dataType: "Decimal",
        config: {
          precision: decimalType.precision,
          scale: decimalType.scale,
          bitWidth: decimalType.bitWidth,
        },
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

    case ArrowTypesEnum.FixedSizeList: {
      const fslType = type as FixedSizeList;
      const childField = fslType.children[0];
      return {
        ...baseField,
        dataType: "FixedSizeList",
        config: {
          listSize: fslType.listSize,
          child: arrowFieldToFieldConfig(childField),
        },
      };
    }

    case ArrowTypesEnum.Struct: {
      const structType = type as Struct;
      return {
        ...baseField,
        dataType: "Struct",
        config: {
          children: structType.children.map(arrowFieldToFieldConfig),
        },
      };
    }

    case ArrowTypesEnum.Dictionary: {
      const dictType = type as Dictionary;
      // Dictionary has a value (dictionary) type and an indices type
      const dictionaryField = new Field(
        "dictionary",
        dictType.dictionary,
        false,
      );
      const indicesField = new Field("indices", dictType.indices, false);
      return {
        ...baseField,
        dataType: "Dictionary",
        config: {
          dictionary: arrowFieldToFieldConfig(dictionaryField),
          indices: arrowFieldToFieldConfig(indicesField),
          ...(dictType.id !== undefined ? { id: dictType.id } : {}),
          ...(dictType.isOrdered ? { isOrdered: dictType.isOrdered } : {}),
        },
      };
    }

    case ArrowTypesEnum.Map: {
      const mapType = type as Map_;
      // Map has an entries struct with key and value fields
      const entriesStruct = mapType.children[0].type as Struct;
      const keyField = entriesStruct.children[0];
      const valueField = entriesStruct.children[1];
      return {
        ...baseField,
        dataType: "Map",
        config: {
          entries: {
            key: arrowFieldToFieldConfig(keyField),
            value: arrowFieldToFieldConfig(valueField),
          },
          ...(mapType.keysSorted ? { keysSorted: mapType.keysSorted } : {}),
        },
      };
    }

    case ArrowTypesEnum.Union: {
      const unionType = type as Union;
      return {
        ...baseField,
        dataType: "Union",
        config: {
          mode: unionType.mode as 0 | 1,
          typeIds: Array.from(unionType.typeIds),
          children: unionType.children.map(arrowFieldToFieldConfig),
        },
      };
    }

    case ArrowTypesEnum.DenseUnion: {
      const denseUnionType = type as DenseUnion;
      return {
        ...baseField,
        dataType: "DenseUnion",
        config: {
          typeIds: Array.from(denseUnionType.typeIds),
          children: denseUnionType.children.map(arrowFieldToFieldConfig),
        },
      };
    }

    case ArrowTypesEnum.SparseUnion: {
      const sparseUnionType = type as SparseUnion;
      return {
        ...baseField,
        dataType: "SparseUnion",
        config: {
          typeIds: Array.from(sparseUnionType.typeIds),
          children: sparseUnionType.children.map(arrowFieldToFieldConfig),
        },
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
