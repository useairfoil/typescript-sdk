import { PartitionValue } from "./proto/log_metadata";

export { PartitionValue } from "./proto/log_metadata";

export const PV = {
  null(): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "nullValue",
      },
    });
  },
  int8(value: number): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "int8Value",
        int8Value: value,
      },
    });
  },
  int16(value: number): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "int16Value",
        int16Value: value,
      },
    });
  },
  int32(value: number): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "int32Value",
        int32Value: value,
      },
    });
  },
  int64(value: bigint): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "int64Value",
        int64Value: value,
      },
    });
  },
  uint8(value: number): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "uint8Value",
        uint8Value: value,
      },
    });
  },
  uint16(value: number): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "uint16Value",
        uint16Value: value,
      },
    });
  },
  uint32(value: number): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "uint32Value",
        uint32Value: value,
      },
    });
  },
  uint64(value: bigint): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "uint64Value",
        uint64Value: value,
      },
    });
  },
  stringValue(value: string): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "stringValue",
        stringValue: value,
      },
    });
  },
  bytesValue(value: Uint8Array): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "bytesValue",
        bytesValue: value,
      },
    });
  },
  boolValue(value: boolean): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "boolValue",
        boolValue: value,
      },
    });
  },
};
