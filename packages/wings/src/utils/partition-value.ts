import { PartitionValue } from "../proto/wings/resources";

/** Partition value type used by Wings partitioned tables. */
export { PartitionValue } from "../proto/wings/resources";

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
