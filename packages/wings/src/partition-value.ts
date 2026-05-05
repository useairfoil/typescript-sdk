import { PartitionValue } from "./proto/wings/v1/log_metadata";

/** Partition value type used by Wings partitioned topics. */
export { PartitionValue } from "./proto/wings/v1/log_metadata";

/**
 * Small helpers for building partition values.
 *
 * @example
 * ```ts
 * const partition = PartitionValue.int32(42)
 * ```
 */
const nullPartitionValue = (): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "nullValue",
    },
  });

export { nullPartitionValue as null };

export const int8 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "int8Value",
      int8Value: value,
    },
  });

export const int16 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "int16Value",
      int16Value: value,
    },
  });

export const int32 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "int32Value",
      int32Value: value,
    },
  });

export const int64 = (value: bigint): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "int64Value",
      int64Value: value,
    },
  });

export const uint8 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "uint8Value",
      uint8Value: value,
    },
  });

export const uint16 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "uint16Value",
      uint16Value: value,
    },
  });

export const uint32 = (value: number): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "uint32Value",
      uint32Value: value,
    },
  });

export const uint64 = (value: bigint): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "uint64Value",
      uint64Value: value,
    },
  });

export const stringValue = (value: string): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "stringValue",
      stringValue: value,
    },
  });

export const bytesValue = (value: Uint8Array): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "bytesValue",
      bytesValue: value,
    },
  });

export const boolValue = (value: boolean): PartitionValue =>
  PartitionValue.create({
    value: {
      $case: "boolValue",
      boolValue: value,
    },
  });
