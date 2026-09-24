import type { TableSchema } from "iceberg-js";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeRowEncoder } from "../src/ingestor/arrow";

const schema: TableSchema = {
  type: "struct",
  fields: [
    { id: 1, name: "id", type: "string", required: true },
    { id: 2, name: "version", type: "long", required: true },
    { id: 3, name: "count", type: "int", required: true },
    { id: 4, name: "updated_at", type: "timestamp", required: false },
    {
      id: 5,
      name: "details",
      required: false,
      type: {
        type: "struct",
        fields: [
          { id: 6, name: "active", type: "boolean", required: true },
          {
            id: 7,
            name: "tags",
            required: false,
            type: {
              type: "list",
              "element-id": 8,
              element: "string",
              "element-required": false,
            },
          },
        ],
      },
    },
  ],
};

describe("Iceberg row encoding", () => {
  it.effect("encodes missing, undefined and null as null in the fixed schema", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder(schema, "id", "version");
      const batch = yield* encode([
        { id: "p1", version: 1n },
        { id: "p2", version: 2n, updated_at: undefined },
        { id: "p3", version: 3n, updated_at: null },
      ]);

      expect(batch.schema.fields.map((field) => field.name)).toEqual([
        "id",
        "version",
        "count",
        "updated_at",
        "details",
      ]);
      expect(batch.schema.fields.every((field) => field.nullable)).toBe(true);
      expect(batch.schema.fields[4]?.type.children[0]?.nullable).toBe(false);
      expect(Array.from(batch.getChild("updated_at") ?? [])).toEqual([null, null, null]);
    }),
  );

  it.effect("keeps Iceberg IDs in Arrow field metadata", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder(
        {
          type: "struct",
          fields: [
            { id: 1, name: "id", type: "string", required: true },
            { id: 2, name: "version", type: "long", required: true },
            {
              id: 3,
              name: "details",
              required: false,
              type: {
                type: "struct",
                fields: [{ id: 101, name: "label", type: "string", required: true }],
              },
            },
            {
              id: 4,
              name: "items",
              required: true,
              type: {
                type: "list",
                "element-id": 201,
                element: "string",
                "element-required": true,
              },
            },
            {
              id: 5,
              name: "lookup",
              required: true,
              type: {
                type: "map",
                "key-id": 301,
                key: "string",
                "value-id": 302,
                value: "string",
                "value-required": false,
              },
            },
          ],
        },
        "id",
        "version",
      );
      const batch = yield* encode([{ id: "1", version: 1n }]);
      const fields = batch.schema.fields;

      expect({
        id: fields[0]?.metadata.get("PARQUET:field_id"),
        details: fields[2]?.type.children[0]?.metadata.get("PARQUET:field_id"),
        items: fields[3]?.type.children[0]?.metadata.get("PARQUET:field_id"),
        mapEntriesMetadataSize: fields[4]?.type.children[0]?.metadata.size,
        mapKey: fields[4]?.type.children[0]?.type.children[0]?.metadata.get("PARQUET:field_id"),
        mapValue: fields[4]?.type.children[0]?.type.children[1]?.metadata.get("PARQUET:field_id"),
      }).toMatchInlineSnapshot(`
        {
          "details": "101",
          "id": "1",
          "items": "201",
          "mapEntriesMetadataSize": 0,
          "mapKey": "301",
          "mapValue": "302",
        }
      `);
    }),
  );

  it.effect("encodes optional nested undefined values as null", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder(schema, "id", "version");
      const batch = yield* encode([
        { id: "p1", version: 1n, details: { active: true, tags: ["a", undefined] } },
      ]);

      expect(Array.from(batch.get(0)?.details.tags ?? [])).toEqual(["a", null]);
    }),
  );

  it.effect("rejects invalid update rows", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder(schema, "id", "version");
      const missingKey = yield* encode([{ version: 1n, count: 1 }]).pipe(Effect.flip);
      const missingVersion = yield* encode([{ id: "p1", count: 1 }]).pipe(Effect.flip);
      const unknown = yield* encode([{ id: "p1", version: 1n, extra: true }]).pipe(Effect.flip);
      const incompatible = yield* encode([{ id: "p1", version: 1n, count: "1" }]).pipe(Effect.flip);

      expect(String(missingKey.cause)).toContain('["id"]');
      expect(String(missingVersion.cause)).toContain('["version"]');
      expect(String(unknown.cause)).toContain('["extra"]');
      expect(String(incompatible.cause)).toContain('["count"]');
    }),
  );

  it.effect("encodes UUID and binary fields with Iceberg Arrow types", () =>
    Effect.gen(function* () {
      const encode = yield* makeRowEncoder(
        {
          type: "struct",
          fields: [
            { id: 1, name: "id", type: "uuid", required: true },
            { id: 2, name: "version", type: "long", required: true },
            { id: 3, name: "payload", type: "binary", required: false },
          ],
        },
        "id",
        "version",
      );
      const batch = yield* encode([
        { id: new Uint8Array(16), version: 1n, payload: new Uint8Array([1, 2]) },
      ]);

      expect(batch.schema.fields.map((field) => field.type.toString())).toEqual([
        "FixedSizeBinary[16]",
        "Int64",
        "LargeBinary",
      ]);
    }),
  );

  it.effect("rejects unsupported Iceberg types", () =>
    makeRowEncoder(
      {
        type: "struct",
        fields: [
          { id: 1, name: "id", type: "string", required: true },
          { id: 2, name: "version", type: "long", required: true },
          { id: 3, name: "value", type: "unknown_type", required: false },
        ],
      },
      "id",
      "version",
    ).pipe(
      Effect.flip,
      Effect.map((error) => expect(error.message).toBe("Failed to convert Iceberg schema")),
    ),
  );
});
