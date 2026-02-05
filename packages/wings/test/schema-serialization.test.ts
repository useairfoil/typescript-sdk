import { describe, expect, it } from "vitest";
import {
  deserializeSchemaBytesToFieldConfigs,
  serializeFieldsToSchemaBytes,
} from "../src/lib/arrow/registry";
import type { FieldConfig } from "../src/lib/arrow/schema";

/**
 * Helper function to test round-trip serialization/deserialization
 */
function testRoundTrip(fieldConfig: FieldConfig) {
  const schemaBytes = serializeFieldsToSchemaBytes([fieldConfig]);
  const result = deserializeSchemaBytesToFieldConfigs(schemaBytes);
  expect(result).toHaveLength(1);
  return result[0];
}

/**
 * NOTE: Apache Arrow internally normalizes certain type aliases:
 * - Int8, Int16, Int32, Int64 → Int (with bitWidth and isSigned config)
 * - Uint8, Uint16, Uint32, Uint64 → Int (with bitWidth and isSigned=false)
 * - Float16, Float32, Float64 → Float (with precision config)
 * - DateDay, DateMillisecond → Date (with unit config)
 * - TimeSecond, TimeMillisecond, TimeMicrosecond, TimeNanosecond → Time (with unit config)
 * - DurationSecond, DurationMillisecond, etc. → Duration (with unit config)
 * - TimestampSecond, TimestampMillisecond, etc. → Timestamp (with unit config)
 * - IntervalDayTime, IntervalYearMonth, IntervalMonthDayNano → Interval (with unit config)
 * - DenseUnion, SparseUnion → Union (with mode config)
 *
 * These tests verify correct serialization/deserialization behavior considering this normalization.
 */

describe("Schema Serialization Round-Trip", () => {
  it("round-trips primitive types", () => {
    type SimpleType = Exclude<
      FieldConfig["dataType"],
      "Duration" | "Timestamp" | "List" | "Struct"
    >;
    const types: SimpleType[] = [
      "Bool",
      "Utf8",
      "Binary",
      "Null",
      "Int8",
      "Int16",
      "Int32",
      "Int64",
      "Uint8",
      "Uint16",
      "Uint32",
      "Uint64",
      "Float16",
      "Float32",
      "Float64",
      "DateDay",
      "DateMillisecond",
      "DurationSecond",
      "DurationMillisecond",
      "DurationMicrosecond",
      "DurationNanosecond",
      "TimestampSecond",
      "TimestampMillisecond",
      "TimestampMicrosecond",
      "TimestampNanosecond",
    ];

    let id = 1n;
    for (const dataType of types) {
      const result = testRoundTrip({
        name: "test",
        dataType,
        nullable: false,
        id,
      });
      expect(result.dataType).toBe(dataType);
      expect(result.id).toBe(id);
      id += 1n;
    }
  });

  it("round-trips duration config", () => {
    const result = testRoundTrip({
      name: "duration",
      dataType: "Duration",
      nullable: true,
      id: 100n,
      config: { unit: 2 },
    });
    expect(result.dataType).toBe("Duration");
    if (result.dataType === "Duration") {
      expect(result.config.unit).toBe(2);
    }
  });

  it("round-trips timestamp config", () => {
    const result = testRoundTrip({
      name: "ts",
      dataType: "Timestamp",
      nullable: false,
      id: 101n,
      config: { unit: 1, timezone: "UTC" },
    });
    expect(result.dataType).toBe("Timestamp");
    if (result.dataType === "Timestamp") {
      expect(result.config.unit).toBe(1);
      expect(result.config.timezone).toBe("UTC");
    }
  });

  it("round-trips list and struct", () => {
    const listResult = testRoundTrip({
      name: "items",
      dataType: "List",
      nullable: false,
      id: 200n,
      config: {
        child: { name: "item", dataType: "Utf8", nullable: false, id: 201n },
      },
    });
    expect(listResult.dataType).toBe("List");

    const structResult = testRoundTrip({
      name: "meta",
      dataType: "Struct",
      nullable: true,
      id: 300n,
      config: {
        children: [
          { name: "name", dataType: "Utf8", nullable: false, id: 301n },
          { name: "age", dataType: "Int32", nullable: false, id: 302n },
        ],
      },
    });
    expect(structResult.dataType).toBe("Struct");
  });
});
