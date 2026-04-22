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
  "Duration",
  "Timestamp",
  "List",
  "Struct",
] as const satisfies EnumKeys<typeof ArrowTypesEnum>[];

export const allArrowTypes = [
  ...partitionKeyArrowTypes,
  "Float16",
  "Float32",
  "Float64",
  "DateDay",
  "DateMillisecond",
  "DurationSecond",
  "DurationMillisecond",
  "DurationMicrosecond",
  "DurationNanosecond",
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

export interface ListConfig {
  child: FieldConfig;
}

export interface StructConfig {
  children: FieldConfig[];
}

export interface FieldConfigMap {
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
  Float16: EmptyConfig | undefined;
  Float32: EmptyConfig | undefined;
  Float64: EmptyConfig | undefined;
  DateDay: EmptyConfig | undefined;
  DateMillisecond: EmptyConfig | undefined;
  Duration: DurationConfig;
  DurationSecond: EmptyConfig | undefined;
  DurationMillisecond: EmptyConfig | undefined;
  DurationMicrosecond: EmptyConfig | undefined;
  DurationNanosecond: EmptyConfig | undefined;
  Timestamp: TimestampConfig;
  TimestampSecond: TimestampVariantConfig | undefined;
  TimestampMillisecond: TimestampVariantConfig | undefined;
  TimestampMicrosecond: TimestampVariantConfig | undefined;
  TimestampNanosecond: TimestampVariantConfig | undefined;
  Struct: StructConfig;
  List: ListConfig;
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
