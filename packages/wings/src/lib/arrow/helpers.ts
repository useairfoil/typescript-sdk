import { type RecordBatch, Table } from "apache-arrow";
import {
  complexArrowTypes,
  type FieldConfig,
  type FieldConfigMap,
  partitionKeyArrowTypes,
} from "./schema";

export function requiresArrowConfiguration(
  dataType: FieldConfig["dataType"],
): boolean {
  return complexArrowTypes.includes(
    dataType as (typeof complexArrowTypes)[number],
  );
}

export function canBePartitionKey(dataType: FieldConfig["dataType"]): boolean {
  return partitionKeyArrowTypes.includes(
    dataType as (typeof partitionKeyArrowTypes)[number],
  );
}

type DefaultConfigValues = {
  [K in FieldConfig["dataType"]]: FieldConfigMap[K];
};

const defaultConfigValues: DefaultConfigValues = {
  Int: {
    isSigned: false,
    bitWidth: 8,
  },
  Int8: {},
  Int16: {},
  Int32: {},
  Int64: {},
  Uint8: {},
  Uint16: {},
  Uint32: {},
  Uint64: {},
  Bool: {},
  Utf8: {},
  Binary: {},
  Null: {},
  Float: {
    precision: 0,
  },
  Float16: {},
  Float32: {},
  Float64: {},
  LargeUtf8: {},
  LargeBinary: {},
  Date: {
    unit: 0,
  },
  DateDay: {},
  DateMillisecond: {},
  Time: {
    unit: 0,
    bitWidth: 32,
  },
  TimeSecond: {},
  TimeMillisecond: {},
  TimeMicrosecond: {},
  TimeNanosecond: {},
  Duration: {
    unit: 0,
  },
  DurationSecond: {},
  DurationMillisecond: {},
  DurationMicrosecond: {},
  DurationNanosecond: {},
  Interval: {
    unit: 0,
  },
  IntervalDayTime: {},
  IntervalYearMonth: {},
  IntervalMonthDayNano: {},

  // Types with configurations
  FixedSizeBinary: { byteWidth: 32 },
  TimestampMillisecond: {},
  TimestampMicrosecond: {},
  TimestampNanosecond: {},
  Decimal: {
    precision: 10,
    scale: 2,
    bitWidth: 128,
  },
  Timestamp: {
    unit: 0,
  },
  TimestampSecond: {},
  List: {
    child: {
      dataType: "Utf8",
      name: "item",
      nullable: false,
    },
  },
  FixedSizeList: {
    listSize: 10,
    child: {
      dataType: "Utf8",
      name: "item",
      nullable: false,
    },
  },
  Struct: {
    children: [
      { name: "name", dataType: "Utf8", nullable: false },
      { name: "age", dataType: "Int8", nullable: false },
    ],
  },
  Dictionary: {
    dictionary: {
      dataType: "Utf8",
      name: "key",
      nullable: false,
    },
    indices: {
      dataType: "Int8",
      name: "value",
      nullable: false,
    },
  },
  Union: {
    mode: 0,
    typeIds: [1, 2],
    children: [
      { name: "str", dataType: "Utf8", nullable: false },
      { name: "num", dataType: "Int8", nullable: false },
    ],
  },
  DenseUnion: {
    typeIds: [1, 2],
    children: [
      { name: "str", dataType: "Utf8", nullable: false },
      { name: "num", dataType: "Int8", nullable: false },
    ],
  },
  SparseUnion: {
    typeIds: [1, 2],
    children: [
      { name: "str", dataType: "Utf8", nullable: false },
      { name: "num", dataType: "Int8", nullable: false },
    ],
  },
  Map: {
    entries: {
      key: {
        dataType: "Utf8",
        name: "key",
        nullable: false,
      },
      value: {
        dataType: "Int8",
        name: "value",
        nullable: false,
      },
    },
  },
} as const;

export function getDefaultConfigForType<T extends FieldConfig["dataType"]>(
  dataType: T,
) {
  return defaultConfigValues[dataType];
}

export function getGroupedArrowTypes() {
  return {
    Integers: [
      { value: "Int", label: "Int (integer)" },
      { value: "Int8", label: "Int8 (8-bit signed integer)" },
      { value: "Int16", label: "Int16 (16-bit signed integer)" },
      { value: "Int32", label: "Int32 (32-bit signed integer)" },
      { value: "Int64", label: "Int64 (64-bit signed integer)" },
      { value: "Uint8", label: "Uint8 (8-bit unsigned integer)" },
      { value: "Uint16", label: "Uint16 (16-bit unsigned integer)" },
      { value: "Uint32", label: "Uint32 (32-bit unsigned integer)" },
      { value: "Uint64", label: "Uint64 (64-bit unsigned integer)" },
    ],
    "Floating Point": [
      { value: "Float", label: "Float (floating point)" },
      { value: "Float16", label: "Float16 (16-bit floating point)" },
      { value: "Float32", label: "Float32 (32-bit floating point)" },
      { value: "Float64", label: "Float64 (64-bit floating point)" },
    ],
    "Boolean & Null": [
      { value: "Bool", label: "Boolean" },
      { value: "Null", label: "Null" },
    ],
    "String & Binary": [
      { value: "Utf8", label: "UTF-8 String" },
      { value: "LargeUtf8", label: "Large UTF-8 String" },
      { value: "Binary", label: "Binary Data" },
      { value: "LargeBinary", label: "Large Binary Data" },
      { value: "FixedSizeBinary", label: "Fixed Size Binary" },
    ],
    "Date & Time": [
      { value: "Date", label: "Date (date)" },
      { value: "DateDay", label: "Date (days since epoch)" },
      { value: "DateMillisecond", label: "Date (milliseconds since epoch)" },
      { value: "Time", label: "Time (time)" },
      { value: "TimeSecond", label: "Time (seconds)" },
      { value: "TimeMillisecond", label: "Time (milliseconds)" },
      { value: "TimeMicrosecond", label: "Time (microseconds)" },
      { value: "TimeNanosecond", label: "Time (nanoseconds)" },
      { value: "Timestamp", label: "Timestamp (timestamp)" },
      { value: "TimestampSecond", label: "Timestamp (seconds)" },
      { value: "TimestampMillisecond", label: "Timestamp (milliseconds)" },
      { value: "TimestampMicrosecond", label: "Timestamp (microseconds)" },
      { value: "TimestampNanosecond", label: "Timestamp (nanoseconds)" },
    ],
    "Duration & Interval": [
      { value: "Duration", label: "Duration (duration)" },
      { value: "DurationSecond", label: "Duration (seconds)" },
      { value: "DurationMillisecond", label: "Duration (milliseconds)" },
      { value: "DurationMicrosecond", label: "Duration (microseconds)" },
      { value: "DurationNanosecond", label: "Duration (nanoseconds)" },
      { value: "Interval", label: "Interval (interval)" },
      { value: "IntervalDayTime", label: "Interval (day-time)" },
      { value: "IntervalYearMonth", label: "Interval (year-month)" },
      { value: "IntervalMonthDayNano", label: "Interval (month-day-nano)" },
    ],
    Decimal: [{ value: "Decimal", label: "Decimal (fixed precision)" }],
    "Complex Types": [
      { value: "List", label: "List (variable length)" },
      { value: "FixedSizeList", label: "Fixed Size List" },
      { value: "Struct", label: "Struct (record type)" },
      { value: "Map", label: "Map (key-value pairs)" },
      { value: "Dictionary", label: "Dictionary (encoded values)" },
      { value: "Union", label: "Union (union type)" },
      { value: "DenseUnion", label: "Dense Union" },
      { value: "SparseUnion", label: "Sparse Union" },
    ],
  };
}

export function recordBatchToTable(batch: RecordBatch[]) {
  return new Table(batch);
}

export function arrowTableToRowColumns(table: Table) {
  const columns = table.schema.fields.map((field) => ({
    name: field.name,
    type: field.type.toString(),
  }));
  const rows = table.toArray();
  return { columns, rows };
}
