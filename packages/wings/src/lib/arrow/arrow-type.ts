import {
  Type as ArrowTypesEnum,
  Binary,
  Bool,
  type DataType,
  type Date_,
  DateDay,
  DateMillisecond,
  type Duration,
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
  type Timestamp,
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
import type * as proto from "../../proto/schema/arrow_type";

export const FIELD_ID_METADATA_KEY = "PARQUET:field_id";

const emptyMessage = (): proto.EmptyMessage => ({
  $type: "wings.schema.EmptyMessage",
});

const createArrowType = (
  arrowTypeEnum: NonNullable<proto.ArrowType["arrowTypeEnum"]>,
): proto.ArrowType => ({
  $type: "wings.schema.ArrowType",
  arrowTypeEnum,
});

const createTimestamp = (options: {
  timeUnit: proto.TimeUnit;
  timezone: string;
}): proto.Timestamp => ({
  $type: "wings.schema.Timestamp",
  timeUnit: options.timeUnit,
  timezone: options.timezone,
});

const createList = (fieldType: proto.Field): proto.List => ({
  $type: "wings.schema.List",
  fieldType,
});

const createStruct = (subFieldTypes: proto.Field[]): proto.Struct => ({
  $type: "wings.schema.Struct",
  subFieldTypes,
});

const toProtoTimeUnit = (unit: number): proto.TimeUnit => {
  switch (unit) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 4;
    default:
      throw new Error(`Unsupported Arrow time unit: ${unit}`);
  }
};

const toArrowDuration = (unit: proto.TimeUnit): Duration => {
  switch (unit) {
    case 1:
      return new DurationSecond();
    case 2:
      return new DurationMillisecond();
    case 3:
      return new DurationMicrosecond();
    case 4:
      return new DurationNanosecond();
    default:
      throw new Error(`Unsupported proto duration unit: ${unit}`);
  }
};

const toArrowTimestamp = (
  timeUnit: proto.TimeUnit,
  timezone: string,
): Timestamp => {
  const tz = timezone.length > 0 ? timezone : null;
  switch (timeUnit) {
    case 1:
      return new TimestampSecond(tz);
    case 2:
      return new TimestampMillisecond(tz);
    case 3:
      return new TimestampMicrosecond(tz);
    case 4:
      return new TimestampNanosecond(tz);
    default:
      throw new Error(`Unsupported proto timestamp unit: ${timeUnit}`);
  }
};

const resolveSchemaMetadata = (
  metadata?: Map<string, string> | null,
): Map<string, string> => (metadata ? new Map(metadata) : new Map());

const resolveFieldMetadata = (
  metadata?: Map<string, string> | null,
): Map<string, string> => {
  if (!metadata) {
    return new Map();
  }

  return new Map(
    Array.from(metadata.entries()).filter(
      ([key]) => key !== FIELD_ID_METADATA_KEY,
    ),
  );
};

const parseFieldId = (field: Field): bigint => {
  if (!field.metadata) {
    throw new Error(`Missing field id metadata for ${field.name}`);
  }

  const rawId = field.metadata.get(FIELD_ID_METADATA_KEY);
  if (!rawId) {
    throw new Error(`Missing field id metadata for ${field.name}`);
  }

  try {
    return BigInt(rawId);
  } catch (error) {
    throw new Error(
      `Invalid field id metadata for ${field.name}: ${String(error)}`,
    );
  }
};

export function arrowSchemaFromProto(schema: proto.Schema): Schema {
  const arrowTypeFromProto = (arrowType?: proto.ArrowType): DataType => {
    if (!arrowType?.arrowTypeEnum) {
      throw new Error("Arrow type is undefined");
    }

    switch (arrowType.arrowTypeEnum.$case) {
      case "none":
        return new Null();
      case "bool":
        return new Bool();
      case "uint8":
        return new Uint8();
      case "int8":
        return new Int8();
      case "uint16":
        return new Uint16();
      case "int16":
        return new Int16();
      case "uint32":
        return new Uint32();
      case "int32":
        return new Int32();
      case "uint64":
        return new Uint64();
      case "int64":
        return new Int64();
      case "float16":
        return new Float16();
      case "float32":
        return new Float32();
      case "float64":
        return new Float64();
      case "utf8":
        return new Utf8();
      case "binary":
        return new Binary();
      case "date32":
        return new DateDay();
      case "date64":
        return new DateMillisecond();
      case "duration":
        return toArrowDuration(arrowType.arrowTypeEnum.duration);
      case "timestamp":
        return toArrowTimestamp(
          arrowType.arrowTypeEnum.timestamp.timeUnit,
          arrowType.arrowTypeEnum.timestamp.timezone,
        );
      case "list": {
        const fieldType = arrowType.arrowTypeEnum.list.fieldType;
        if (!fieldType) {
          throw new Error("List type is missing fieldType");
        }
        const childField = arrowFieldFromProto(fieldType);
        return new List(childField);
      }
      case "struct": {
        const fields =
          arrowType.arrowTypeEnum.struct.subFieldTypes.map(arrowFieldFromProto);
        return new Struct(fields);
      }
      default:
        throw new Error("Unsupported Arrow type in proto schema");
    }
  };

  const arrowFieldFromProto = (field: proto.Field): Field => {
    if (field.id === 0n) {
      throw new Error(`Field id is required for ${field.name}`);
    }
    const fieldId = field.id;
    const metadata = new Map(Object.entries(field.metadata));
    metadata.set(FIELD_ID_METADATA_KEY, fieldId.toString());

    return new Field(
      field.name,
      arrowTypeFromProto(field.arrowType),
      field.nullable,
      metadata,
    );
  };

  return new Schema(
    schema.fields.map(arrowFieldFromProto),
    schema.metadata ? new Map(schema.metadata) : new Map(),
  );
}

export function arrowSchemaToProto(schema: Schema): proto.Schema {
  const arrowTypeToProto = (dataType: DataType): proto.ArrowType => {
    switch (dataType.typeId as ArrowTypesEnum) {
      case ArrowTypesEnum.Null:
        return createArrowType({ $case: "none", none: emptyMessage() });
      case ArrowTypesEnum.Bool:
        return createArrowType({ $case: "bool", bool: emptyMessage() });
      case ArrowTypesEnum.Int: {
        const intType = dataType as Int;
        switch (intType.bitWidth) {
          case 8:
            return intType.isSigned
              ? createArrowType({ $case: "int8", int8: emptyMessage() })
              : createArrowType({ $case: "uint8", uint8: emptyMessage() });
          case 16:
            return intType.isSigned
              ? createArrowType({ $case: "int16", int16: emptyMessage() })
              : createArrowType({ $case: "uint16", uint16: emptyMessage() });
          case 32:
            return intType.isSigned
              ? createArrowType({ $case: "int32", int32: emptyMessage() })
              : createArrowType({ $case: "uint32", uint32: emptyMessage() });
          case 64:
            return intType.isSigned
              ? createArrowType({ $case: "int64", int64: emptyMessage() })
              : createArrowType({ $case: "uint64", uint64: emptyMessage() });
          default:
            throw new Error(
              `Unsupported Arrow int bitWidth: ${intType.bitWidth}`,
            );
        }
      }
      case ArrowTypesEnum.Uint8:
        return createArrowType({ $case: "uint8", uint8: emptyMessage() });
      case ArrowTypesEnum.Int8:
        return createArrowType({ $case: "int8", int8: emptyMessage() });
      case ArrowTypesEnum.Uint16:
        return createArrowType({ $case: "uint16", uint16: emptyMessage() });
      case ArrowTypesEnum.Int16:
        return createArrowType({ $case: "int16", int16: emptyMessage() });
      case ArrowTypesEnum.Uint32:
        return createArrowType({ $case: "uint32", uint32: emptyMessage() });
      case ArrowTypesEnum.Int32:
        return createArrowType({ $case: "int32", int32: emptyMessage() });
      case ArrowTypesEnum.Uint64:
        return createArrowType({ $case: "uint64", uint64: emptyMessage() });
      case ArrowTypesEnum.Int64:
        return createArrowType({ $case: "int64", int64: emptyMessage() });
      case ArrowTypesEnum.Float16:
        return createArrowType({ $case: "float16", float16: emptyMessage() });
      case ArrowTypesEnum.Float32:
        return createArrowType({ $case: "float32", float32: emptyMessage() });
      case ArrowTypesEnum.Float64:
        return createArrowType({ $case: "float64", float64: emptyMessage() });
      case ArrowTypesEnum.Float: {
        const floatType = dataType as Float;
        switch (floatType.precision) {
          case 0:
            return createArrowType({
              $case: "float16",
              float16: emptyMessage(),
            });
          case 1:
            return createArrowType({
              $case: "float32",
              float32: emptyMessage(),
            });
          case 2:
            return createArrowType({
              $case: "float64",
              float64: emptyMessage(),
            });
          default:
            throw new Error(
              `Unsupported Arrow float precision: ${floatType.precision}`,
            );
        }
      }
      case ArrowTypesEnum.Utf8:
        return createArrowType({ $case: "utf8", utf8: emptyMessage() });
      case ArrowTypesEnum.Binary:
        return createArrowType({ $case: "binary", binary: emptyMessage() });
      case ArrowTypesEnum.Date: {
        const dateType = dataType as Date_;
        return dateType.unit === 0
          ? createArrowType({ $case: "date32", date32: emptyMessage() })
          : createArrowType({ $case: "date64", date64: emptyMessage() });
      }
      case ArrowTypesEnum.DateDay:
        return createArrowType({ $case: "date32", date32: emptyMessage() });
      case ArrowTypesEnum.DateMillisecond:
        return createArrowType({ $case: "date64", date64: emptyMessage() });
      case ArrowTypesEnum.Duration:
        return createArrowType({
          $case: "duration",
          duration: toProtoTimeUnit((dataType as Duration).unit),
        });
      case ArrowTypesEnum.DurationSecond:
        return createArrowType({ $case: "duration", duration: 1 });
      case ArrowTypesEnum.DurationMillisecond:
        return createArrowType({ $case: "duration", duration: 2 });
      case ArrowTypesEnum.DurationMicrosecond:
        return createArrowType({ $case: "duration", duration: 3 });
      case ArrowTypesEnum.DurationNanosecond:
        return createArrowType({ $case: "duration", duration: 4 });
      case ArrowTypesEnum.Timestamp: {
        const timestamp = dataType as Timestamp;
        return createArrowType({
          $case: "timestamp",
          timestamp: createTimestamp({
            timeUnit: toProtoTimeUnit(timestamp.unit),
            timezone: timestamp.timezone ?? "",
          }),
        });
      }
      case ArrowTypesEnum.TimestampSecond: {
        const timestamp = dataType as TimestampSecond;
        return createArrowType({
          $case: "timestamp",
          timestamp: createTimestamp({
            timeUnit: 1,
            timezone: timestamp.timezone ?? "",
          }),
        });
      }
      case ArrowTypesEnum.TimestampMillisecond: {
        const timestamp = dataType as TimestampMillisecond;
        return createArrowType({
          $case: "timestamp",
          timestamp: createTimestamp({
            timeUnit: 2,
            timezone: timestamp.timezone ?? "",
          }),
        });
      }
      case ArrowTypesEnum.TimestampMicrosecond: {
        const timestamp = dataType as TimestampMicrosecond;
        return createArrowType({
          $case: "timestamp",
          timestamp: createTimestamp({
            timeUnit: 3,
            timezone: timestamp.timezone ?? "",
          }),
        });
      }
      case ArrowTypesEnum.TimestampNanosecond: {
        const timestamp = dataType as TimestampNanosecond;
        return createArrowType({
          $case: "timestamp",
          timestamp: createTimestamp({
            timeUnit: 4,
            timezone: timestamp.timezone ?? "",
          }),
        });
      }
      case ArrowTypesEnum.List: {
        const listType = dataType as List;
        const childField = listType.children[0];
        if (!childField) {
          throw new Error("List type is missing child field");
        }
        return createArrowType({
          $case: "list",
          list: createList(arrowFieldToProto(childField)),
        });
      }
      case ArrowTypesEnum.Struct: {
        const structType = dataType as Struct;
        return createArrowType({
          $case: "struct",
          struct: createStruct(structType.children.map(arrowFieldToProto)),
        });
      }
      default:
        throw new Error(`Unsupported Arrow type: ${dataType.typeId}`);
    }
  };

  const arrowFieldToProto = (field: Field): proto.Field => {
    const resolvedId = parseFieldId(field);

    return {
      $type: "wings.schema.Field",
      name: field.name,
      id: resolvedId,
      arrowType: arrowTypeToProto(field.type),
      nullable: field.nullable,
      metadata: resolveFieldMetadata(field.metadata),
    };
  };

  return {
    $type: "wings.schema.Schema",
    fields: schema.fields.map(arrowFieldToProto),
    metadata: resolveSchemaMetadata(schema.metadata),
  };
}
