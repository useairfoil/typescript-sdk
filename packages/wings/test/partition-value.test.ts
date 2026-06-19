import { describe, expect, it } from "vitest";

import * as PartitionValue from "../src/utils/partition-value";

describe("PartitionValue", () => {
  it("exposes only Wings-supported partition value helpers", () => {
    expect(PartitionValue).not.toHaveProperty("null");

    const cases = [
      PartitionValue.int8(1),
      PartitionValue.int16(2),
      PartitionValue.int32(3),
      PartitionValue.int64(4n),
      PartitionValue.uint8(5),
      PartitionValue.uint16(6),
      PartitionValue.uint32(7),
      PartitionValue.uint64(8n),
      PartitionValue.string("partition"),
      PartitionValue.bytes(new Uint8Array([9])),
      PartitionValue.boolean(true),
    ];

    expect(cases.map((value) => value.value?.$case)).toEqual([
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
  });
});
