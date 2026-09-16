import type { TableSchema } from "iceberg-js";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeRowEncoder } from "../src/ingestor/arrow";

const schema: TableSchema = {
  type: "struct",
  fields: [
    { id: 1, name: "id", type: "string", required: true },
    { id: 2, name: "count", type: "int", required: true },
    { id: 3, name: "updated_at", type: "timestamp", required: false },
    {
      id: 4,
      name: "details",
      required: false,
      type: {
        type: "struct",
        fields: [
          { id: 5, name: "active", type: "boolean", required: true },
          {
            id: 6,
            name: "tags",
            required: false,
            type: {
              type: "list",
              "element-id": 7,
              element: "string",
              "element-required": true,
            },
          },
        ],
      },
    },
  ],
};

describe("Iceberg row encoding", () => {
  it.effect("uses the Iceberg field order and a stable nullable Arrow schema", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder(schema);
      const batch = yield* encode([
        {
          id: "p1",
          count: 1,
          updated_at: new Date("2026-01-01T00:00:00.000Z"),
          details: { active: true, tags: ["new"] },
        },
        { id: "p2", count: 2 },
      ]);

      expect(batch.schema.fields.map((field) => field.name)).toEqual([
        "id",
        "count",
        "updated_at",
        "details",
      ]);
      expect(batch.schema.fields.every((field) => field.nullable)).toBe(true);
      expect(batch.schema.fields[3]?.type.children[0]?.nullable).toBe(false);
      expect(batch.getChild("updated_at")?.get(1)).toBeNull();
      expect(batch.numRows).toBe(2);
    }),
  );

  it.effect("encodes optional nested undefined values as null", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder({
        type: "struct",
        fields: [
          {
            id: 1,
            name: "details",
            required: false,
            type: {
              type: "struct",
              fields: [
                {
                  id: 2,
                  name: "tags",
                  required: false,
                  type: {
                    type: "list",
                    "element-id": 3,
                    element: "string",
                    "element-required": false,
                  },
                },
              ],
            },
          },
          {
            id: 4,
            name: "items",
            required: false,
            type: {
              type: "list",
              "element-id": 5,
              element: "string",
              "element-required": false,
            },
          },
          {
            id: 6,
            name: "attrs",
            required: false,
            type: {
              type: "map",
              "key-id": 7,
              key: "string",
              "value-id": 8,
              value: "int",
              "value-required": false,
            },
          },
        ],
      });
      const batch = yield* encode([
        { details: {}, items: ["a", undefined], attrs: new Map([["a", undefined]]) },
      ]);

      expect(JSON.stringify(batch.get(0))).toBe(
        JSON.stringify({ details: { tags: null }, items: ["a", null], attrs: { a: null } }),
      );
    }),
  );

  it.effect("rejects unknown fields and incompatible values", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder(schema);
      const unknown = yield* encode([{ id: "p1", count: 1, extra: true }]).pipe(Effect.flip);
      const incompatible = yield* encode([{ id: "p1", count: "1" }]).pipe(Effect.flip);
      const invalidRow = yield* encode([new Map()]).pipe(Effect.flip);
      const floatEncode = yield* makeRowEncoder({
        type: "struct",
        fields: [{ id: 1, name: "value", type: "float", required: false }],
      });
      const overflow = yield* floatEncode([{ value: 1e100 }]).pipe(Effect.flip);

      expect(unknown.message).toBe("Failed to encode rows");
      expect(String(unknown.cause)).toContain('["extra"]');
      expect(String(incompatible.cause)).toContain('["count"]');
      expect(String(invalidRow.cause)).toContain("no known fields");
      expect(String(overflow.cause)).toContain('["value"]');
    }),
  );

  it.effect("encodes UUID and binary fields with Iceberg Arrow types", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder({
        type: "struct",
        fields: [
          { id: 1, name: "id", type: "uuid", required: true },
          { id: 2, name: "payload", type: "binary", required: false },
        ],
      });
      const batch = yield* encode([{ id: new Uint8Array(16), payload: new Uint8Array([1, 2]) }]);

      expect(batch.schema.fields.map((field) => field.type.toString())).toEqual([
        "FixedSizeBinary[16]",
        "LargeBinary",
      ]);
    }),
  );

  it.effect("rejects unsupported Iceberg types", () =>
    makeRowEncoder({
      type: "struct",
      fields: [{ id: 1, name: "value", type: "unknown_type", required: false }],
    }).pipe(
      Effect.flip,
      Effect.map((error) => expect(error.message).toBe("Failed to convert Iceberg schema")),
    ),
  );
});
