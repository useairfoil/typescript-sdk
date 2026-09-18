import {
  Bool,
  DateDay,
  Decimal,
  Field,
  FixedSizeBinary,
  Float32,
  Float64,
  Int32,
  Int64,
  LargeBinary,
  List,
  Map_,
  RecordBatch,
  Schema as ArrowSchema,
  Struct,
  TimeMicrosecond,
  TimestampMicrosecond,
  Utf8,
  makeBuilder,
  type DataType,
  type TypeMap,
} from "apache-arrow";
import { Effect, Schema } from "effect";
import {
  parseDecimalType,
  parseFixedType,
  type IcebergType,
  type PrimitiveType,
  type TableSchema,
} from "iceberg-js";

import { ConnectorError } from "../errors";

// Nothing converts an Iceberg schema to Arrow for us, so we do it here.
// Each type also gets a schema for its values, because Arrow does not reject a bad
// value, it converts it: "1" becomes 1, and 1.5 becomes 1.

type RowSchema = Schema.Codec<unknown, unknown>;

/** One Iceberg type: the Arrow type, and the values it accepts. */
type Compiled = {
  readonly type: DataType;
  readonly row: RowSchema;
};

// Arrow pads or cuts binary values to fit.
const bytes = (length: number) =>
  Schema.Uint8Array.check(
    Schema.makeFilter(
      (value: Uint8Array) => value.byteLength === length || `expected ${length} bytes`,
    ),
  );

// Arrow wraps big integers instead of failing, so check the range.
const int32 = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: -2_147_483_648, maximum: 2_147_483_647 }),
);

const int64 = Schema.BigInt.check(
  Schema.isBetweenBigInt({ minimum: -(2n ** 63n), maximum: 2n ** 63n - 1n }),
);

// Arrow turns a number outside the 32-bit range into Infinity.
const float32 = Schema.Finite.check(
  Schema.makeFilter(
    (value: number) => Number.isFinite(Math.fround(value)) || "expected a 32-bit number",
  ),
);

const microsecondsInDay = Schema.BigInt.check(
  Schema.isBetweenBigInt({ minimum: 0n, maximum: 86_399_999_999n }),
);

const primitives: Record<string, Compiled> = {
  boolean: { type: new Bool(), row: Schema.Boolean },
  int: { type: new Int32(), row: int32 },
  long: { type: new Int64(), row: int64 },
  float: { type: new Float32(), row: float32 },
  double: { type: new Float64(), row: Schema.Finite },
  string: { type: new Utf8(), row: Schema.String },
  uuid: { type: new FixedSizeBinary(16), row: bytes(16) },
  binary: { type: new LargeBinary(), row: Schema.Uint8Array },
  date: { type: new DateDay(), row: Schema.Date },
  time: { type: new TimeMicrosecond(), row: microsecondsInDay },
  timestamp: { type: new TimestampMicrosecond(), row: Schema.Date },
  timestamptz: { type: new TimestampMicrosecond("UTC"), row: Schema.Date },
};

const primitive = (type: PrimitiveType): Compiled => {
  const known = primitives[type];

  if (known) return known;

  // Nothing checks the catalog metadata, and Arrow takes any precision.
  // Better to fail here than at write time.
  const decimal = parseDecimalType(type);

  if (decimal) {
    if (decimal.precision < 1 || decimal.precision > 38 || decimal.scale > decimal.precision) {
      throw new Error(`Invalid Iceberg decimal type ${type}`);
    }

    return {
      type: new Decimal(decimal.scale, decimal.precision),
      row: Schema.instanceOf(Uint32Array).check(
        Schema.makeFilter((value: Uint32Array) => value.length === 4 || "expected four words"),
      ),
    };
  }

  const fixed = parseFixedType(type);

  if (fixed) {
    if (fixed.length < 1) throw new Error(`Invalid Iceberg fixed type ${type}`);

    return { type: new FixedSizeBinary(fixed.length), row: bytes(fixed.length) };
  }

  throw new Error(`Unsupported Iceberg type ${type}`);
};

/** Absent and null both become null in Arrow. */
const optional = (row: RowSchema) => Schema.optional(Schema.NullOr(row));

/** Same as `primitive`, plus struct, list and map. */
const compileType = (type: IcebergType): Compiled => {
  if (typeof type === "string") return primitive(type);

  if (type.type === "struct") {
    const fields = type.fields.map((field) => ({ ...field, compiled: compileType(field.type) }));

    return {
      type: new Struct(
        fields.map((field) => new Field(field.name, field.compiled.type, !field.required)),
      ),
      row: Schema.Struct(
        Object.fromEntries(
          fields.map((field) => [
            field.name,
            field.required ? field.compiled.row : optional(field.compiled.row),
          ]),
        ),
      ),
    };
  }

  if (type.type === "list") {
    const element = compileType(type.element);
    const required = type["element-required"];

    return {
      type: new List(new Field("element", element.type, !required)),
      row: Schema.Array(required ? element.row : Schema.NullishOr(element.row)),
    };
  }

  const key = compileType(type.key);
  const value = compileType(type.value);
  const required = type["value-required"];
  const entries = new Struct([
    new Field("key", key.type, false),
    new Field("value", value.type, !required),
  ]);

  return {
    type: new Map_(new Field("entries", entries, false)),
    row: Schema.ReadonlyMap(key.row, required ? value.row : Schema.NullishOr(value.row)),
  };
};

export type RowEncoder = (
  rows: ReadonlyArray<object>,
) => Effect.Effect<RecordBatch<TypeMap>, ConnectorError>;

export const makeRowEncoder = (
  tableSchema: TableSchema,
  key: string,
  version: string,
): Effect.Effect<RowEncoder, ConnectorError> =>
  Effect.try({
    try: () => {
      const fields = tableSchema.fields.map((field) => ({
        name: field.name,
        ...compileType(field.type),
      }));
      const fieldNames = new Set(fields.map((field) => field.name));
      const required = new Set([key, version]);

      if (!fieldNames.has(key)) throw new Error(`Missing key column ${key}`);
      if (!fieldNames.has(version)) throw new Error(`Missing version column ${version}`);

      const struct = new Struct(fields.map((field) => new Field(field.name, field.type, true)));
      const schema = new ArrowSchema(struct.children);

      const decodeRow = Schema.decodeUnknownSync(
        Schema.Struct(
          Object.fromEntries(
            fields.map((field) => [
              field.name,
              required.has(field.name) ? field.row : optional(field.row),
            ]),
          ),
        ),
        { onExcessProperty: "error" },
      );

      // Schema says which field is wrong. This adds the row number.
      const decodeAt = (row: object, index: number) => {
        try {
          return decodeRow(row) as Record<string, unknown>;
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : String(cause);
          throw new Error(`row ${index}: ${detail}`, { cause });
        }
      };

      return (rows: ReadonlyArray<object>) =>
        Effect.try({
          try: () => {
            const builder = makeBuilder({ type: struct, nullValues: [null, undefined] });

            for (const [index, row] of rows.entries()) {
              builder.append(decodeAt(row, index) as Struct<TypeMap>["TValue"]);
            }

            return new RecordBatch(schema, builder.finish().flush());
          },
          catch: (cause) => new ConnectorError({ message: "Failed to encode rows", cause }),
        });
    },
    catch: (cause) => new ConnectorError({ message: "Failed to convert Iceberg schema", cause }),
  });
