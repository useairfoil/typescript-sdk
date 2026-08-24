import { Effect, Encoding, Result, Schema } from "effect";

import { WingsDecodeError } from "../errors";
import { PartitionValue } from "../proto/wings/resources";

/** Partition value type used by Wings partitioned tables. */
export { PartitionValue } from "../proto/wings/resources";

/** JSON discriminators supported by the Wings partition-value wire format. */
export const JsonType = Schema.Literals([
  "int8",
  "int16",
  "int32",
  "int64",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "string",
  "bytes",
  "boolean",
]);
export type JsonType = Schema.Schema.Type<typeof JsonType>;

/** JSON-safe representation of every Wings partition primitive. */
export type Json =
  | {
      readonly type: "int8" | "int16" | "int32" | "uint8" | "uint16" | "uint32";
      readonly value: number;
    }
  | {
      readonly type: "int64" | "uint64" | "bytes" | "string";
      readonly value: string;
    }
  | {
      readonly type: "boolean";
      readonly value: boolean;
    };

/**
 * Small helpers for building partition values.
 *
 * @example
 * ```ts
 * const partition = PartitionValue.int32(42)
 * ```
 */
export const int8 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "int8",
      int8: value,
    },
  });

export const int16 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "int16",
      int16: value,
    },
  });

export const int32 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "int32",
      int32: value,
    },
  });

export const int64 = (value: bigint): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "int64",
      int64: value,
    },
  });

export const uint8 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "uint8",
      uint8: value,
    },
  });

export const uint16 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "uint16",
      uint16: value,
    },
  });

export const uint32 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "uint32",
      uint32: value,
    },
  });

export const uint64 = (value: bigint): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "uint64",
      uint64: value,
    },
  });

export const string = (value: string): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "string",
      string: value,
    },
  });

export const bytes = (value: Uint8Array): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "bytes",
      bytes: value,
    },
  });

export const boolean = (value: boolean): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "boolean",
      boolean: value,
    },
  });

const invalid = (message: string, cause?: unknown) =>
  new WingsDecodeError(message, cause === undefined ? undefined : { cause });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const boundedInteger = (value: unknown, minimum: number, maximum: number, type: string) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw invalid(`Partition ${type} value is out of range`);
  }
  return value;
};

const bigintValue = (value: unknown, signed: boolean, type: string) => {
  if (typeof value !== "string" || !/^-?(0|[1-9][0-9]*)$/.test(value)) {
    throw invalid(`Partition ${type} value must be a decimal string`);
  }
  const decoded = BigInt(value);
  const minimum = signed ? -(1n << 63n) : 0n;
  const maximum = signed ? (1n << 63n) - 1n : (1n << 64n) - 1n;
  if (decoded < minimum || decoded > maximum) {
    throw invalid(`Partition ${type} value is out of range`);
  }
  return decoded;
};

/** Decodes the public JSON representation into the protobuf value used by Wings APIs. */
export const decodeJson = (input: unknown): Effect.Effect<PartitionValue, WingsDecodeError> =>
  Effect.try({
    try: () => {
      if (
        !isRecord(input) ||
        Object.keys(input).length !== 2 ||
        !("type" in input) ||
        !("value" in input)
      ) {
        throw invalid("Partition values require exactly type and value");
      }
      const type = Schema.decodeUnknownSync(JsonType)(input.type);
      switch (type) {
        case "int8":
          return int8(boundedInteger(input.value, -128, 127, type));
        case "int16":
          return int16(boundedInteger(input.value, -32768, 32767, type));
        case "int32":
          return int32(boundedInteger(input.value, -2147483648, 2147483647, type));
        case "int64":
          return int64(bigintValue(input.value, true, type));
        case "uint8":
          return uint8(boundedInteger(input.value, 0, 255, type));
        case "uint16":
          return uint16(boundedInteger(input.value, 0, 65535, type));
        case "uint32":
          return uint32(boundedInteger(input.value, 0, 4294967295, type));
        case "uint64":
          return uint64(bigintValue(input.value, false, type));
        case "string":
          if (typeof input.value !== "string") {
            throw invalid("Partition string value must be a string");
          }
          return string(input.value);
        case "bytes": {
          if (typeof input.value !== "string") {
            throw invalid("Partition bytes value must be base64 text");
          }
          const decoded = Encoding.decodeBase64(input.value);
          if (Result.isFailure(decoded)) {
            throw invalid("Partition bytes value must be valid base64 text", decoded.failure);
          }
          return bytes(decoded.success);
        }
        case "boolean":
          if (typeof input.value !== "boolean") {
            throw invalid("Partition boolean value must be a boolean");
          }
          return boolean(input.value);
      }
    },
    catch: (cause) =>
      cause instanceof WingsDecodeError ? cause : invalid("Invalid Wings partition value", cause),
  });
