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
  describe("Simple types without config", () => {
    it("should round-trip Bool", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Bool",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Bool");
      expect(result.name).toBe("test");
      expect(result.nullable).toBe(false);
    });

    it("should round-trip Utf8", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Utf8",
        nullable: true,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Utf8");
      expect(result.nullable).toBe(true);
    });

    it("should round-trip Binary", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Binary",
        nullable: false,
      };
      expect(testRoundTrip(field).dataType).toBe("Binary");
    });

    it("should round-trip Null", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Null",
        nullable: true,
      };
      expect(testRoundTrip(field).dataType).toBe("Null");
    });

    it("should round-trip LargeUtf8", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "LargeUtf8",
        nullable: false,
      };
      expect(testRoundTrip(field).dataType).toBe("LargeUtf8");
    });

    it("should round-trip LargeBinary", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "LargeBinary",
        nullable: false,
      };
      expect(testRoundTrip(field).dataType).toBe("LargeBinary");
    });
  });

  describe("Integer types (normalized to Int with config)", () => {
    it("should round-trip Int8 as Int", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Int8",
        nullable: false,
      };
      const result = testRoundTrip(field);
      // Arrow normalizes Int8 to Int with config
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.bitWidth).toBe(8);
        expect(result.config.isSigned).toBe(true);
      }
    });

    it("should round-trip Int16 as Int", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Int16",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.bitWidth).toBe(16);
        expect(result.config.isSigned).toBe(true);
      }
    });

    it("should round-trip Int32 as Int", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Int32",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.bitWidth).toBe(32);
        expect(result.config.isSigned).toBe(true);
      }
    });

    it("should round-trip Int64 as Int", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Int64",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.bitWidth).toBe(64);
        expect(result.config.isSigned).toBe(true);
      }
    });

    it("should round-trip Uint8 as Int (unsigned)", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Uint8",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.bitWidth).toBe(8);
        expect(result.config.isSigned).toBe(false);
      }
    });

    it("should round-trip Uint16 as Int (unsigned)", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Uint16",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.bitWidth).toBe(16);
        expect(result.config.isSigned).toBe(false);
      }
    });

    it("should round-trip Uint32 as Int (unsigned)", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Uint32",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.bitWidth).toBe(32);
        expect(result.config.isSigned).toBe(false);
      }
    });

    it("should round-trip Uint64 as Int (unsigned)", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Uint64",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.bitWidth).toBe(64);
        expect(result.config.isSigned).toBe(false);
      }
    });

    it("should round-trip Int with explicit config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Int",
        nullable: false,
        config: { isSigned: true, bitWidth: 32 },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Int");
      if (result.dataType === "Int") {
        expect(result.config.isSigned).toBe(true);
        expect(result.config.bitWidth).toBe(32);
      }
    });
  });

  describe("Float types (normalized to Float with precision)", () => {
    it("should round-trip Float16 as Float", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Float16",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Float");
      if (result.dataType === "Float") {
        expect(result.config.precision).toBe(0); // HALF
      }
    });

    it("should round-trip Float32 as Float", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Float32",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Float");
      if (result.dataType === "Float") {
        expect(result.config.precision).toBe(1); // SINGLE
      }
    });

    it("should round-trip Float64 as Float", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Float64",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Float");
      if (result.dataType === "Float") {
        expect(result.config.precision).toBe(2); // DOUBLE
      }
    });

    it("should round-trip Float with explicit config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Float",
        nullable: false,
        config: { precision: 2 },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Float");
      if (result.dataType === "Float") {
        expect(result.config.precision).toBe(2);
      }
    });
  });

  describe("Date types (normalized to Date with unit)", () => {
    it("should round-trip DateDay as Date", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "DateDay",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Date");
      if (result.dataType === "Date") {
        expect(result.config.unit).toBe(0); // DAY
      }
    });

    it("should round-trip DateMillisecond as Date", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "DateMillisecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Date");
      if (result.dataType === "Date") {
        expect(result.config.unit).toBe(1); // MILLISECOND
      }
    });

    it("should round-trip Date with explicit config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Date",
        nullable: false,
        config: { unit: 1 },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Date");
      if (result.dataType === "Date") {
        expect(result.config.unit).toBe(1);
      }
    });
  });

  describe("Time types (normalized to Time with unit)", () => {
    it("should round-trip TimeSecond as Time", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "TimeSecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Time");
      if (result.dataType === "Time") {
        expect(result.config.unit).toBe(0); // SECOND
        expect(result.config.bitWidth).toBe(32);
      }
    });

    it("should round-trip TimeMillisecond as Time", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "TimeMillisecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Time");
      if (result.dataType === "Time") {
        expect(result.config.unit).toBe(1); // MILLISECOND
        expect(result.config.bitWidth).toBe(32);
      }
    });

    it("should round-trip TimeMicrosecond as Time", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "TimeMicrosecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Time");
      if (result.dataType === "Time") {
        expect(result.config.unit).toBe(2); // MICROSECOND
        expect(result.config.bitWidth).toBe(64);
      }
    });

    it("should round-trip TimeNanosecond as Time", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "TimeNanosecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Time");
      if (result.dataType === "Time") {
        expect(result.config.unit).toBe(3); // NANOSECOND
        expect(result.config.bitWidth).toBe(64);
      }
    });

    it("should round-trip Time with explicit config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Time",
        nullable: false,
        config: { unit: 2, bitWidth: 64 },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Time");
      if (result.dataType === "Time") {
        expect(result.config.unit).toBe(2);
        expect(result.config.bitWidth).toBe(64);
      }
    });
  });

  describe("Duration types (normalized to Duration with unit)", () => {
    it("should round-trip DurationSecond as Duration", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "DurationSecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Duration");
      if (result.dataType === "Duration") {
        expect(result.config.unit).toBe(0);
      }
    });

    it("should round-trip DurationMillisecond as Duration", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "DurationMillisecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Duration");
      if (result.dataType === "Duration") {
        expect(result.config.unit).toBe(1);
      }
    });

    it("should round-trip DurationMicrosecond as Duration", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "DurationMicrosecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Duration");
      if (result.dataType === "Duration") {
        expect(result.config.unit).toBe(2);
      }
    });

    it("should round-trip DurationNanosecond as Duration", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "DurationNanosecond",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Duration");
      if (result.dataType === "Duration") {
        expect(result.config.unit).toBe(3);
      }
    });

    it("should round-trip Duration with explicit config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Duration",
        nullable: false,
        config: { unit: 3 },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Duration");
      if (result.dataType === "Duration") {
        expect(result.config.unit).toBe(3);
      }
    });
  });

  describe("Interval types (normalized to Interval with unit)", () => {
    it("should round-trip IntervalYearMonth as Interval", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "IntervalYearMonth",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Interval");
      if (result.dataType === "Interval") {
        expect(result.config.unit).toBe(0);
      }
    });

    it("should round-trip IntervalDayTime as Interval", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "IntervalDayTime",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Interval");
      if (result.dataType === "Interval") {
        expect(result.config.unit).toBe(1);
      }
    });

    it("should round-trip IntervalMonthDayNano as Interval", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "IntervalMonthDayNano",
        nullable: false,
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Interval");
      if (result.dataType === "Interval") {
        expect(result.config.unit).toBe(2);
      }
    });

    it("should round-trip Interval with explicit config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Interval",
        nullable: false,
        config: { unit: 1 },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Interval");
      if (result.dataType === "Interval") {
        expect(result.config.unit).toBe(1);
      }
    });
  });

  describe("Timestamp types (normalized to Timestamp with unit)", () => {
    it("should round-trip TimestampSecond as Timestamp", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "TimestampSecond",
        nullable: false,
        config: { timezone: "UTC" },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Timestamp");
      if (result.dataType === "Timestamp") {
        expect(result.config.unit).toBe(0);
        expect(result.config.timezone).toBe("UTC");
      }
    });

    it("should round-trip TimestampMillisecond as Timestamp", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "TimestampMillisecond",
        nullable: false,
        config: { timezone: "Europe/London" },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Timestamp");
      if (result.dataType === "Timestamp") {
        expect(result.config.unit).toBe(1);
        expect(result.config.timezone).toBe("Europe/London");
      }
    });

    it("should round-trip TimestampMicrosecond as Timestamp", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "TimestampMicrosecond",
        nullable: false,
        config: { timezone: "Asia/Tokyo" },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Timestamp");
      if (result.dataType === "Timestamp") {
        expect(result.config.unit).toBe(2);
        expect(result.config.timezone).toBe("Asia/Tokyo");
      }
    });

    it("should round-trip TimestampNanosecond as Timestamp", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "TimestampNanosecond",
        nullable: false,
        config: { timezone: "Australia/Sydney" },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Timestamp");
      if (result.dataType === "Timestamp") {
        expect(result.config.unit).toBe(3);
        expect(result.config.timezone).toBe("Australia/Sydney");
      }
    });

    it("should round-trip Timestamp with explicit config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Timestamp",
        nullable: false,
        config: { unit: 2, timezone: "UTC" },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Timestamp");
      if (result.dataType === "Timestamp") {
        expect(result.config.unit).toBe(2);
        expect(result.config.timezone).toBe("UTC");
      }
    });
  });

  describe("Other types with config", () => {
    it("should round-trip FixedSizeBinary with config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "FixedSizeBinary",
        nullable: false,
        config: { byteWidth: 16 },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("FixedSizeBinary");
      if (result.dataType === "FixedSizeBinary") {
        expect(result.config.byteWidth).toBe(16);
      }
    });

    it("should round-trip Decimal with config", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Decimal",
        nullable: false,
        config: { precision: 38, scale: 10, bitWidth: 128 },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Decimal");
      if (result.dataType === "Decimal") {
        expect(result.config.precision).toBe(38);
        expect(result.config.scale).toBe(10);
        expect(result.config.bitWidth).toBe(128);
      }
    });
  });

  describe("Nested/Complex types", () => {
    it("should round-trip List", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "List",
        nullable: false,
        config: {
          child: { name: "item", dataType: "Utf8", nullable: false },
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("List");
      if (result.dataType === "List") {
        expect(result.config.child.dataType).toBe("Utf8");
        expect(result.config.child.name).toBe("item");
      }
    });

    it("should round-trip List with Int child (normalized)", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "List",
        nullable: false,
        config: {
          child: { name: "item", dataType: "Int32", nullable: false },
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("List");
      if (result.dataType === "List") {
        // Int32 gets normalized to Int
        expect(result.config.child.dataType).toBe("Int");
        if (result.config.child.dataType === "Int") {
          expect(result.config.child.config.bitWidth).toBe(32);
          expect(result.config.child.config.isSigned).toBe(true);
        }
      }
    });

    it("should round-trip FixedSizeList", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "FixedSizeList",
        nullable: false,
        config: {
          listSize: 5,
          child: { name: "element", dataType: "Utf8", nullable: true },
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("FixedSizeList");
      if (result.dataType === "FixedSizeList") {
        expect(result.config.listSize).toBe(5);
        expect(result.config.child.dataType).toBe("Utf8");
        expect(result.config.child.nullable).toBe(true);
      }
    });

    it("should round-trip Struct", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Struct",
        nullable: false,
        config: {
          children: [
            { name: "name", dataType: "Utf8", nullable: true },
            { name: "active", dataType: "Bool", nullable: false },
          ],
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Struct");
      if (result.dataType === "Struct") {
        expect(result.config.children).toHaveLength(2);
        expect(result.config.children[0].dataType).toBe("Utf8");
        expect(result.config.children[1].dataType).toBe("Bool");
      }
    });

    it("should round-trip Dictionary", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Dictionary",
        nullable: false,
        config: {
          dictionary: { name: "dict", dataType: "Utf8", nullable: false },
          indices: { name: "idx", dataType: "Int32", nullable: false },
          id: 1,
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Dictionary");
      if (result.dataType === "Dictionary") {
        expect(result.config.dictionary.dataType).toBe("Utf8");
        // Indices Int32 gets normalized to Int
        expect(result.config.indices.dataType).toBe("Int");
        expect(result.config.id).toBe(1);
      }
    });

    it("should round-trip Dictionary with isOrdered", () => {
      const field: FieldConfig = {
        name: "ordered_dict",
        dataType: "Dictionary",
        nullable: false,
        config: {
          dictionary: { name: "dict", dataType: "Utf8", nullable: false },
          indices: { name: "idx", dataType: "Int32", nullable: false },
          id: 2,
          isOrdered: true,
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Dictionary");
      if (result.dataType === "Dictionary") {
        expect(result.config.dictionary.dataType).toBe("Utf8");
        expect(result.config.indices.dataType).toBe("Int");
        expect(result.config.id).toBe(2);
        expect(result.config.isOrdered).toBe(true);
      }
    });

    it("should round-trip Map", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Map",
        nullable: false,
        config: {
          entries: {
            key: { name: "key", dataType: "Utf8", nullable: false },
            value: { name: "value", dataType: "Bool", nullable: true },
          },
          keysSorted: true,
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Map");
      if (result.dataType === "Map") {
        expect(result.config.entries.key.dataType).toBe("Utf8");
        expect(result.config.entries.value.dataType).toBe("Bool");
        expect(result.config.keysSorted).toBe(true);
      }
    });

    it("should round-trip Union", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "Union",
        nullable: false,
        config: {
          mode: 0,
          typeIds: [0, 1, 2],
          children: [
            { name: "str_val", dataType: "Utf8", nullable: false },
            { name: "bool_val", dataType: "Bool", nullable: false },
            { name: "binary_val", dataType: "Binary", nullable: false },
          ],
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Union");
      if (result.dataType === "Union") {
        expect(result.config.mode).toBe(0);
        expect(result.config.typeIds).toEqual([0, 1, 2]);
        expect(result.config.children).toHaveLength(3);
      }
    });

    it("should round-trip DenseUnion as Union", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "DenseUnion",
        nullable: false,
        config: {
          typeIds: [0, 1],
          children: [
            { name: "option_a", dataType: "Utf8", nullable: false },
            { name: "option_b", dataType: "Binary", nullable: false },
          ],
        },
      };
      const result = testRoundTrip(field);
      // DenseUnion gets normalized to Union with mode=1
      expect(result.dataType).toBe("Union");
      if (result.dataType === "Union") {
        expect(result.config.mode).toBe(1); // Dense mode
        expect(result.config.typeIds).toEqual([0, 1]);
        expect(result.config.children).toHaveLength(2);
      }
    });

    it("should round-trip SparseUnion as Union", () => {
      const field: FieldConfig = {
        name: "test",
        dataType: "SparseUnion",
        nullable: false,
        config: {
          typeIds: [10, 20],
          children: [
            { name: "sparse_a", dataType: "Utf8", nullable: false },
            { name: "sparse_b", dataType: "Binary", nullable: false },
          ],
        },
      };
      const result = testRoundTrip(field);
      // SparseUnion gets normalized to Union with mode=0
      expect(result.dataType).toBe("Union");
      if (result.dataType === "Union") {
        expect(result.config.mode).toBe(0); // Sparse mode
        expect(result.config.typeIds).toEqual([10, 20]);
        expect(result.config.children).toHaveLength(2);
      }
    });
  });

  describe("Deeply nested structures", () => {
    it("should round-trip deeply nested List of Struct", () => {
      const field: FieldConfig = {
        name: "orders",
        dataType: "List",
        nullable: false,
        config: {
          child: {
            name: "order",
            dataType: "Struct",
            nullable: false,
            config: {
              children: [
                { name: "order_id", dataType: "Utf8", nullable: false },
                {
                  name: "items",
                  dataType: "List",
                  nullable: false,
                  config: {
                    child: {
                      name: "item",
                      dataType: "Struct",
                      nullable: false,
                      config: {
                        children: [
                          { name: "sku", dataType: "Utf8", nullable: false },
                          { name: "active", dataType: "Bool", nullable: false },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("List");
      if (
        result.dataType === "List" &&
        result.config.child.dataType === "Struct"
      ) {
        const structConfig = result.config.child.config;
        expect(structConfig.children).toHaveLength(2);
        expect(structConfig.children[0].dataType).toBe("Utf8");
        expect(structConfig.children[1].dataType).toBe("List");
      }
    });

    it("should round-trip Map with Struct values", () => {
      const field: FieldConfig = {
        name: "user_profiles",
        dataType: "Map",
        nullable: false,
        config: {
          entries: {
            key: { name: "user_id", dataType: "Utf8", nullable: false },
            value: {
              name: "profile",
              dataType: "Struct",
              nullable: true,
              config: {
                children: [
                  { name: "email", dataType: "Utf8", nullable: false },
                  { name: "active", dataType: "Bool", nullable: true },
                ],
              },
            },
          },
        },
      };
      const result = testRoundTrip(field);
      expect(result.dataType).toBe("Map");
      if (
        result.dataType === "Map" &&
        result.config.entries.value.dataType === "Struct"
      ) {
        expect(result.config.entries.value.config.children).toHaveLength(2);
      }
    });
  });

  describe("Field metadata", () => {
    it("should preserve description in round-trip", () => {
      const field: FieldConfig = {
        name: "documented_field",
        dataType: "Utf8",
        nullable: false,
        description: "This is a test field with documentation",
      };
      const result = testRoundTrip(field);
      expect(result.description).toBe(
        "This is a test field with documentation",
      );
    });

    it("should preserve description in nested fields", () => {
      const field: FieldConfig = {
        name: "parent",
        dataType: "Struct",
        nullable: false,
        description: "Parent struct",
        config: {
          children: [
            {
              name: "child",
              dataType: "Utf8",
              nullable: false,
              description: "Child field",
            },
          ],
        },
      };
      const result = testRoundTrip(field);
      expect(result.description).toBe("Parent struct");
      if (result.dataType === "Struct") {
        expect(result.config.children[0].description).toBe("Child field");
      }
    });
  });

  describe("Multiple fields", () => {
    it("should round-trip multiple fields at once", () => {
      const fields: FieldConfig[] = [
        { name: "name", dataType: "Utf8", nullable: true },
        { name: "active", dataType: "Bool", nullable: false },
        { name: "data", dataType: "Binary", nullable: true },
        {
          name: "metadata",
          dataType: "Struct",
          nullable: true,
          config: {
            children: [
              {
                name: "tags",
                dataType: "List",
                nullable: true,
                config: {
                  child: { name: "tag", dataType: "Utf8", nullable: false },
                },
              },
            ],
          },
        },
      ];

      const schemaBytes = serializeFieldsToSchemaBytes(fields);
      const result = deserializeSchemaBytesToFieldConfigs(schemaBytes);

      expect(result).toHaveLength(4);
      expect(result[0].dataType).toBe("Utf8");
      expect(result[1].dataType).toBe("Bool");
      expect(result[2].dataType).toBe("Binary");
      expect(result[3].dataType).toBe("Struct");
    });
  });
});
