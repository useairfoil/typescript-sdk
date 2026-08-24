import { Effect } from "effect";
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

  it("decodes every JSON partition primitive", () => {
    const cases = [
      ["int8", -128, "int8", -128],
      ["int16", 32767, "int16", 32767],
      ["int32", -2147483648, "int32", -2147483648],
      ["int64", "-9223372036854775808", "int64", -(1n << 63n)],
      ["uint8", 255, "uint8", 255],
      ["uint16", 65535, "uint16", 65535],
      ["uint32", 4294967295, "uint32", 4294967295],
      ["uint64", "18446744073709551615", "uint64", (1n << 64n) - 1n],
      ["string", "tenant-a", "string", "tenant-a"],
      ["bytes", "AQID", "bytes", new Uint8Array([1, 2, 3])],
      ["boolean", true, "boolean", true],
    ] as const;

    for (const [type, value, expectedCase, expectedValue] of cases) {
      const decoded = Effect.runSync(PartitionValue.decodeJson({ type, value }));
      expect(decoded.value?.$case).toBe(expectedCase);
      expect(
        decoded.value && (decoded.value as unknown as Record<string, unknown>)[decoded.value.$case],
      ).toEqual(expectedValue);
    }
  });

  it("rejects malformed, out-of-range, unsafe integer, and invalid base64 input", () => {
    const invalid = [
      null,
      { type: "int8", value: 128 },
      { type: "uint32", value: -1 },
      { type: "int64", value: 1 },
      { type: "int64", value: "9223372036854775808" },
      { type: "uint64", value: "18446744073709551616" },
      { type: "bytes", value: "not-base64" },
      { type: "boolean", value: "true" },
      { type: "string", value: "tenant", extra: true },
    ];

    for (const input of invalid) {
      expect(() => Effect.runSync(PartitionValue.decodeJson(input))).toThrow();
    }
  });
});
