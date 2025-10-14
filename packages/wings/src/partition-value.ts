import { PartitionValue } from "./proto/log_metadata";

export { PartitionValue } from "./proto/log_metadata";

export const PV = {
  int64(value: bigint): PartitionValue {
    return PartitionValue.create({
      value: {
        $case: "int64Value",
        int64Value: value,
      },
    });
  },
};
