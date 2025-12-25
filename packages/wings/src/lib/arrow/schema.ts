import type { Type as ArrowTypesEnum } from "apache-arrow";
import { z } from "zod";
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
  "Int",
  "Float",
  "Date",
  "Time",
  "Duration",
  "Interval",
  "FixedSizeBinary",
  "Timestamp",
  "TimestampMillisecond",
  "TimestampMicrosecond",
  "TimestampNanosecond",
  "Decimal",
  "TimestampSecond",
  "List",
  "FixedSizeList",
  "Struct",
  "Dictionary",
  "Union",
  "DenseUnion",
  "SparseUnion",
  "Map",
] as const satisfies EnumKeys<typeof ArrowTypesEnum>[];

export const allArrowTypes = [
  ...partitionKeyArrowTypes,
  "Float16",
  "Float32",
  "Float64",
  "LargeUtf8",
  "LargeBinary",
  "DateDay",
  "DateMillisecond",
  "TimeSecond",
  "TimeMillisecond",
  "TimeMicrosecond",
  "TimeNanosecond",
  "DurationSecond",
  "DurationMillisecond",
  "DurationMicrosecond",
  "DurationNanosecond",
  "IntervalDayTime",
  "IntervalYearMonth",
  "IntervalMonthDayNano",
  // complex types with configurations
  ...complexArrowTypes,
] as const satisfies EnumKeys<typeof ArrowTypesEnum>[];

const fieldNameSchema = z
  .string()
  .regex(/^[a-z_0-9]+$/, {
    message:
      "Field name can contain lowercase letters, numbers, or underscore.",
  })
  .min(1, {
    message: "Field name must be at least 1 character.",
  })
  .max(32, {
    message: "Field name must be less than 32 characters.",
  });

const baseFieldSchema = z.object({
  name: fieldNameSchema,
  description: z.string().optional(),
  nullable: z.boolean(),
});

// base field that all FieldConfig variants share
interface BaseField {
  name: string;
  description?: string;
  nullable: boolean;
}

// config types for each Arrow dataType
interface IntConfig {
  isSigned: boolean;
  bitWidth: 8 | 16 | 32 | 64;
}
interface FloatConfig {
  precision: 0 | 1 | 2;
}
interface DateConfig {
  unit: 0 | 1;
}
interface TimeConfig {
  unit: 0 | 1 | 2 | 3;
  bitWidth: 32 | 64;
}
interface DurationConfig {
  unit: 0 | 1 | 2 | 3;
}
interface IntervalConfig {
  unit: 0 | 1 | 2;
}
interface FixedSizeBinaryConfig {
  byteWidth: number;
}
interface DecimalConfig {
  precision: number;
  scale: number;
  bitWidth: number;
}
interface TimestampConfig {
  unit: 0 | 1 | 2 | 3;
  timezone?: string;
}
interface TimestampVariantConfig {
  timezone?: string;
}
type EmptyConfig = Record<string, never>;

// Recursive config types - interfaces can self-reference!
interface FixedSizeListConfig {
  listSize: number;
  child: FieldConfig;
}
interface ListConfig {
  child: FieldConfig;
}
interface StructConfig {
  children: FieldConfig[];
}
interface DictionaryConfig {
  dictionary: FieldConfig;
  indices: FieldConfig;
  id?: number;
  isOrdered?: boolean;
}
interface MapConfig {
  entries: {
    key: FieldConfig;
    value: FieldConfig;
  };
  keysSorted?: boolean;
}
interface UnionConfig {
  mode: 0 | 1;
  typeIds: number[];
  children: FieldConfig[];
}
interface DenseUnionConfig {
  typeIds: number[];
  children: FieldConfig[];
}
interface SparseUnionConfig {
  typeIds: number[];
  children: FieldConfig[];
}

// config map: maps each dataType to its config type
interface FieldConfigMap {
  Int: IntConfig;
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
  Float: FloatConfig;
  Float16: EmptyConfig | undefined;
  Float32: EmptyConfig | undefined;
  Float64: EmptyConfig | undefined;
  LargeUtf8: EmptyConfig | undefined;
  LargeBinary: EmptyConfig | undefined;
  Date: DateConfig;
  DateDay: EmptyConfig | undefined;
  DateMillisecond: EmptyConfig | undefined;
  Time: TimeConfig;
  TimeSecond: EmptyConfig | undefined;
  TimeMillisecond: EmptyConfig | undefined;
  TimeMicrosecond: EmptyConfig | undefined;
  TimeNanosecond: EmptyConfig | undefined;
  Duration: DurationConfig;
  DurationSecond: EmptyConfig | undefined;
  DurationMillisecond: EmptyConfig | undefined;
  DurationMicrosecond: EmptyConfig | undefined;
  DurationNanosecond: EmptyConfig | undefined;
  Interval: IntervalConfig;
  IntervalDayTime: EmptyConfig | undefined;
  IntervalYearMonth: EmptyConfig | undefined;
  IntervalMonthDayNano: EmptyConfig | undefined;
  FixedSizeBinary: FixedSizeBinaryConfig;
  FixedSizeList: FixedSizeListConfig;
  Decimal: DecimalConfig;
  Timestamp: TimestampConfig;
  TimestampSecond: TimestampVariantConfig | undefined;
  TimestampMillisecond: TimestampVariantConfig | undefined;
  TimestampMicrosecond: TimestampVariantConfig | undefined;
  TimestampNanosecond: TimestampVariantConfig | undefined;
  Dictionary: DictionaryConfig;
  Struct: StructConfig;
  List: ListConfig;
  Map: MapConfig;
  Union: UnionConfig;
  DenseUnion: DenseUnionConfig;
  SparseUnion: SparseUnionConfig;
}

// Types that have optional/empty configs
type OptionalConfigTypes =
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
  | "LargeUtf8"
  | "LargeBinary"
  | "DateDay"
  | "DateMillisecond"
  | "TimeSecond"
  | "TimeMillisecond"
  | "TimeMicrosecond"
  | "TimeNanosecond"
  | "DurationSecond"
  | "DurationMillisecond"
  | "DurationMicrosecond"
  | "DurationNanosecond"
  | "IntervalDayTime"
  | "IntervalYearMonth"
  | "IntervalMonthDayNano"
  | "TimestampSecond"
  | "TimestampMillisecond"
  | "TimestampMicrosecond"
  | "TimestampNanosecond";

// helper type: if K is an optional config type, make config optional
type FieldConfigVariant<K extends keyof FieldConfigMap> = Prettify<
  BaseField & { dataType: K } & (K extends OptionalConfigTypes
      ? { config?: FieldConfigMap[K] }
      : { config: FieldConfigMap[K] })
>;

// the main FieldConfig type - a discriminated union built from the map
export type FieldConfig = {
  [K in keyof FieldConfigMap]: FieldConfigVariant<K>;
}[keyof FieldConfigMap];

// lazy schema that uses the full FieldConfig type
const lazyFieldConfig: z.ZodType<FieldConfig> = z.lazy(() => fieldConfigSchema);

// non-recursive schemas
const intConfigSchema = z.object({
  isSigned: z.boolean(),
  bitWidth: z.union([
    z.literal(8),
    z.literal(16),
    z.literal(32),
    z.literal(64),
  ]),
});

const floatConfigSchema = z.object({
  precision: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

const dateConfigSchema = z.object({
  unit: z.union([z.literal(0), z.literal(1)]),
});

const timeConfigSchema = z.object({
  unit: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  bitWidth: z.union([z.literal(32), z.literal(64)]),
});

const durationConfigSchema = z.object({
  unit: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

const intervalConfigSchema = z.object({
  unit: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

const fixedSizeBinaryConfigSchema = z.object({
  byteWidth: z.int().positive().min(1).max(1024),
});

const decimalConfigSchema = z
  .object({
    precision: z.int().positive().min(1).max(38),
    scale: z.int().min(0).max(38),
    bitWidth: z
      .number()
      .int()
      .positive()
      .refine((val) => [128, 256].includes(val), {
        message: "bitWidth must be 128 or 256",
      }),
  })
  .refine((data) => data.scale <= data.precision, {
    message: "Scale cannot exceed precision",
    path: ["scale"],
  });

const timestampConfigSchema = z.object({
  unit: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  timezone: z.string().optional(),
});

const timestampVariantConfigSchema = z
  .object({
    timezone: z.string().optional(),
  })
  .optional();

const emptyConfigSchema = z.object({}).optional();

// recursive schemas - use lazyFieldConfig typed as z.ZodType<FieldConfig>
const fixedSizeListConfigSchema = z.object({
  listSize: z.int().positive().min(1),
  child: lazyFieldConfig,
});

const dictionaryConfigSchema = z.object({
  dictionary: lazyFieldConfig,
  indices: lazyFieldConfig
    .refine((data) => data.nullable === false, {
      message: "Indices cannot be nullable",
    })
    .refine(
      (data) =>
        data.dataType === "Int8" ||
        data.dataType === "Int16" ||
        data.dataType === "Int32" ||
        data.dataType === "Uint8" ||
        data.dataType === "Uint16" ||
        data.dataType === "Uint32",
      {
        message: "Indices must be Int8, Int16, Int32, Uint8, Uint16, or Uint32",
      },
    ),
  id: z.int().optional(),
  isOrdered: z.boolean().optional(),
});

const structConfigSchema = z.object({
  children: z.array(lazyFieldConfig),
});

const listConfigSchema = z.object({
  child: lazyFieldConfig,
});

const mapConfigSchema = z.object({
  entries: z.object({
    key: lazyFieldConfig.refine((data) => data.nullable === false, {
      message: "Key cannot be nullable",
    }),
    value: lazyFieldConfig,
  }),
  keysSorted: z.boolean().optional(),
});

const unionConfigSchema = z.object({
  mode: z.union([z.literal(0), z.literal(1)]),
  typeIds: z.array(z.int().positive()),
  children: z.array(lazyFieldConfig),
});

const denseUnionConfigSchema = z.object({
  typeIds: z.array(z.int().positive()),
  children: z.array(lazyFieldConfig),
});

const sparseUnionConfigSchema = z.object({
  typeIds: z.array(z.int().positive()),
  children: z.array(lazyFieldConfig),
});

export const arrowConfigSchema = {
  Int: intConfigSchema,
  Int8: emptyConfigSchema,
  Int16: emptyConfigSchema,
  Int32: emptyConfigSchema,
  Int64: emptyConfigSchema,
  Uint8: emptyConfigSchema,
  Uint16: emptyConfigSchema,
  Uint32: emptyConfigSchema,
  Uint64: emptyConfigSchema,
  Bool: emptyConfigSchema,
  Utf8: emptyConfigSchema,
  Binary: emptyConfigSchema,
  Null: emptyConfigSchema,
  Float: floatConfigSchema,
  Float16: emptyConfigSchema,
  Float32: emptyConfigSchema,
  Float64: emptyConfigSchema,
  LargeUtf8: emptyConfigSchema,
  LargeBinary: emptyConfigSchema,
  Date: dateConfigSchema,
  DateDay: emptyConfigSchema,
  DateMillisecond: emptyConfigSchema,
  Time: timeConfigSchema,
  TimeSecond: emptyConfigSchema,
  TimeMillisecond: emptyConfigSchema,
  TimeMicrosecond: emptyConfigSchema,
  TimeNanosecond: emptyConfigSchema,
  Duration: durationConfigSchema,
  DurationSecond: emptyConfigSchema,
  DurationMillisecond: emptyConfigSchema,
  DurationMicrosecond: emptyConfigSchema,
  DurationNanosecond: emptyConfigSchema,
  Interval: intervalConfigSchema,
  IntervalDayTime: emptyConfigSchema,
  IntervalYearMonth: emptyConfigSchema,
  IntervalMonthDayNano: emptyConfigSchema,
  FixedSizeBinary: fixedSizeBinaryConfigSchema,
  FixedSizeList: fixedSizeListConfigSchema,
  Decimal: decimalConfigSchema,
  Timestamp: timestampConfigSchema,
  TimestampSecond: timestampVariantConfigSchema,
  TimestampMillisecond: timestampVariantConfigSchema,
  TimestampMicrosecond: timestampVariantConfigSchema,
  TimestampNanosecond: timestampVariantConfigSchema,
  Dictionary: dictionaryConfigSchema,
  Struct: structConfigSchema,
  List: listConfigSchema,
  Map: mapConfigSchema,
  Union: unionConfigSchema,
  DenseUnion: denseUnionConfigSchema,
  SparseUnion: sparseUnionConfigSchema,
} satisfies Record<
  Exclude<EnumKeys<typeof ArrowTypesEnum>, "NONE">,
  z.ZodTypeAny
>;

export const fieldConfigSchema: z.ZodType<FieldConfig> = z.discriminatedUnion(
  "dataType",
  [
    baseFieldSchema.extend({
      dataType: z.literal("Int"),
      config: intConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Int8"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Int16"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Int32"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Int64"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Uint8"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Uint16"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Uint32"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Uint64"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Bool"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Utf8"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Binary"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Null"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Float"),
      config: floatConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Float16"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Float32"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Float64"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("LargeUtf8"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("LargeBinary"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Date"),
      config: dateConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("DateDay"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("DateMillisecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Time"),
      config: timeConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("TimeSecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("TimeMillisecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("TimeMicrosecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("TimeNanosecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Duration"),
      config: durationConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("DurationSecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("DurationMillisecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("DurationMicrosecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("DurationNanosecond"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Interval"),
      config: intervalConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("IntervalDayTime"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("IntervalYearMonth"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("IntervalMonthDayNano"),
      config: emptyConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("FixedSizeBinary"),
      config: fixedSizeBinaryConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("FixedSizeList"),
      config: fixedSizeListConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Decimal"),
      config: decimalConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Timestamp"),
      config: timestampConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("TimestampSecond"),
      config: timestampVariantConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("TimestampMillisecond"),
      config: timestampVariantConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("TimestampMicrosecond"),
      config: timestampVariantConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("TimestampNanosecond"),
      config: timestampVariantConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Dictionary"),
      config: dictionaryConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Struct"),
      config: structConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("List"),
      config: listConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Map"),
      config: mapConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("Union"),
      config: unionConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("DenseUnion"),
      config: denseUnionConfigSchema,
    }),
    baseFieldSchema.extend({
      dataType: z.literal("SparseUnion"),
      config: sparseUnionConfigSchema,
    }),
  ],
);
