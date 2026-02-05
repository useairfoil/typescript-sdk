import type { Type as ArrowTypesEnum } from "apache-arrow";
import type { EnumKeys, Prettify } from "../type-helpers";

export const partitionKeyArrowTypes = [
  "Int8",
  "Int16",
  "Int32",
  "Int64",
  "Uint8",
  "Uint16",
  "Uint32",
  "Uint64",
  "Bool",
  "Utf8",
  "Binary",
  "Null",
] as const satisfies EnumKeys<typeof ArrowTypesEnum>[];

export const complexArrowTypes = [
  // "Int",
  // "Float",
  // "Date",
  // "Time",
  "Duration",
  // "Interval",
  // "FixedSizeBinary",
  "Timestamp",
  // "TimestampMillisecond",
  // "TimestampMicrosecond",
  // "TimestampNanosecond",
  // "Decimal",
  // "TimestampSecond",
  "List",
  // "FixedSizeList",
  "Struct",
  // "Dictionary",
  // "Union",
  // "DenseUnion",
  // "SparseUnion",
  // "Map",
] as const satisfies EnumKeys<typeof ArrowTypesEnum>[];

export const allArrowTypes = [
  ...partitionKeyArrowTypes,
  "Float16",
  "Float32",
  "Float64",
  // "LargeUtf8",
  // "LargeBinary",
  "DateDay",
  "DateMillisecond",
  // "TimeSecond",
  // "TimeMillisecond",
  // "TimeMicrosecond",
  // "TimeNanosecond",
  "DurationSecond",
  "DurationMillisecond",
  "DurationMicrosecond",
  "DurationNanosecond",
  // "IntervalDayTime",
  // "IntervalYearMonth",
  // "IntervalMonthDayNano",
  "TimestampSecond",
  "TimestampMillisecond",
  "TimestampMicrosecond",
  "TimestampNanosecond",
  // complex types with configurations
  ...complexArrowTypes,
] as const satisfies EnumKeys<typeof ArrowTypesEnum>[];

export interface BaseField {
  name: string;
  description?: string;
  nullable: boolean;
  id: bigint;
}

// Unsupported config types (proto does not include them yet).
// Keeping commented definitions for future reference.
/*
export interface IntConfig {
  isSigned: boolean;
  bitWidth: 8 | 16 | 32 | 64;
}

export interface FloatConfig {
  precision: 0 | 1 | 2;
}

export interface DateConfig {
  unit: 0 | 1;
}

export interface TimeConfig {
  unit: 0 | 1 | 2 | 3;
  bitWidth: 32 | 64;
}
*/

export interface DurationConfig {
  unit: 0 | 1 | 2 | 3;
}

export interface TimestampConfig {
  unit: 0 | 1 | 2 | 3;
  timezone?: string;
}

export interface TimestampVariantConfig {
  timezone?: string;
}

export type EmptyConfig = Record<string, never>;

/*
export interface IntervalConfig {
  unit: 0 | 1 | 2;
}

export interface FixedSizeBinaryConfig {
  byteWidth: number;
}

export interface DecimalConfig {
  precision: number;
  scale: number;
  bitWidth: number;
}

export interface FixedSizeListConfig {
  listSize: number;
  child: FieldConfig;
}
*/

export interface ListConfig {
  child: FieldConfig;
}

export interface StructConfig {
  children: FieldConfig[];
}

/*
export interface DictionaryConfig {
  dictionary: FieldConfig;
  indices: FieldConfig;
  id?: number;
  isOrdered?: boolean;
}

export interface MapConfig {
  entries: {
    key: FieldConfig;
    value: FieldConfig;
  };
  keysSorted?: boolean;
}

export interface UnionConfig {
  mode: 0 | 1;
  typeIds: number[];
  children: FieldConfig[];
}

export interface DenseUnionConfig {
  typeIds: number[];
  children: FieldConfig[];
}

export interface SparseUnionConfig {
  typeIds: number[];
  children: FieldConfig[];
}
*/

export interface FieldConfigMap {
  // Int: IntConfig;
  Int8: EmptyConfig | undefined;
  Int16: EmptyConfig | undefined;
  Int32: EmptyConfig | undefined;
  Int64: EmptyConfig | undefined;
  Uint8: EmptyConfig | undefined;
  Uint16: EmptyConfig | undefined;
  Uint32: EmptyConfig | undefined;
  Uint64: EmptyConfig | undefined;
  Bool: EmptyConfig | undefined;
  Utf8: EmptyConfig | undefined;
  Binary: EmptyConfig | undefined;
  Null: EmptyConfig | undefined;
  // Float: FloatConfig;
  Float16: EmptyConfig | undefined;
  Float32: EmptyConfig | undefined;
  Float64: EmptyConfig | undefined;
  // LargeUtf8: EmptyConfig | undefined;
  // LargeBinary: EmptyConfig | undefined;
  // Date: DateConfig;
  DateDay: EmptyConfig | undefined;
  DateMillisecond: EmptyConfig | undefined;
  // Time: TimeConfig;
  // TimeSecond: EmptyConfig | undefined;
  // TimeMillisecond: EmptyConfig | undefined;
  // TimeMicrosecond: EmptyConfig | undefined;
  // TimeNanosecond: EmptyConfig | undefined;
  Duration: DurationConfig;
  DurationSecond: EmptyConfig | undefined;
  DurationMillisecond: EmptyConfig | undefined;
  DurationMicrosecond: EmptyConfig | undefined;
  DurationNanosecond: EmptyConfig | undefined;
  // Interval: IntervalConfig;
  // IntervalDayTime: EmptyConfig | undefined;
  // IntervalYearMonth: EmptyConfig | undefined;
  // IntervalMonthDayNano: EmptyConfig | undefined;
  // FixedSizeBinary: FixedSizeBinaryConfig;
  Timestamp: TimestampConfig;
  TimestampSecond: TimestampVariantConfig | undefined;
  TimestampMillisecond: TimestampVariantConfig | undefined;
  TimestampMicrosecond: TimestampVariantConfig | undefined;
  TimestampNanosecond: TimestampVariantConfig | undefined;
  // Decimal: DecimalConfig;
  Struct: StructConfig;
  List: ListConfig;
  // FixedSizeList: FixedSizeListConfig;
  // Dictionary: DictionaryConfig;
  // Union: UnionConfig;
  // DenseUnion: DenseUnionConfig;
  // SparseUnion: SparseUnionConfig;
  // Map: MapConfig;
}

export type OptionalConfigTypes =
  | "Int8"
  | "Int16"
  | "Int32"
  | "Int64"
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Uint64"
  | "Bool"
  | "Utf8"
  | "Binary"
  | "Null"
  | "Float16"
  | "Float32"
  | "Float64"
  | "DateDay"
  | "DateMillisecond"
  | "DurationSecond"
  | "DurationMillisecond"
  | "DurationMicrosecond"
  | "DurationNanosecond"
  | "TimestampSecond"
  | "TimestampMillisecond"
  | "TimestampMicrosecond"
  | "TimestampNanosecond";

// helper type - if K is an optional config type, make config optional
export type FieldConfigVariant<K extends keyof FieldConfigMap> = Prettify<
  BaseField & { dataType: K } & (K extends OptionalConfigTypes
      ? { config?: FieldConfigMap[K] }
      : { config: FieldConfigMap[K] })
>;

// the main FieldConfig type - a discriminated union built from the map
export type FieldConfig = {
  [K in keyof FieldConfigMap]: FieldConfigVariant<K>;
}[keyof FieldConfigMap];
