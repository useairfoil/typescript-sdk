import type { CommitTableRequest, TableSchema } from "iceberg-js";

import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema, SchemaTransformation } from "effect";

import * as Iceberg from "../src/iceberg";

const requestOf = (schema: Schema.Top, uuid = "6d334acc-4a2d-4a1f-a66e-b39ba6bb90dd") =>
  Iceberg.makeCreateTableCommitRequest(schema, {
    location: "s3://warehouse/rows",
    uuid,
  });

const errorOf = (schema: Schema.Top) => requestOf(schema).pipe(Effect.flip);

const schemaOf = (request: CommitTableRequest): TableSchema => {
  const update = request.updates.find((update) => update.action === "add-schema");

  if (update?.action !== "add-schema") throw new Error("Missing add-schema update");
  return update.schema;
};

describe("Iceberg table creation commits", () => {
  it.effect("compiles IDs, types, requiredness, and documentation", () => {
    const Details = Schema.Struct({
      createdAt: Schema.Date.pipe(Iceberg.field(101, { description: "Creation time." })),
      payload: Schema.Uint8Array.pipe(Iceberg.field(102)),
      score: Schema.Finite.pipe(Iceberg.field(103)),
      labels: Schema.Array(Schema.NullOr(Schema.String).annotate({ fieldId: 105 })).pipe(
        Iceberg.field(104),
      ),
      attributes: Schema.ReadonlyMap(
        Schema.String.annotate({ fieldId: 107 }),
        Schema.NullOr(Schema.Int).annotate({ fieldId: 108 }),
      ).pipe(Iceberg.field(106)),
    });

    const Row = Schema.Struct({
      id: Schema.String.pipe(
        Iceberg.field(1, { title: "ID", description: "Provider identifier.", examples: ["a"] }),
      ),
      version: Schema.BigInt.pipe(Iceberg.field(2)),
      active: Schema.optional(Schema.Boolean).pipe(Iceberg.field(3)),
      state: Schema.Literals(["open", "closed"]).pipe(Iceberg.field(4)),
      details: Schema.NullOr(Details).pipe(Iceberg.field(5)),
    }).annotate({ title: "Rows", description: "Connector rows.", examples: [] });

    return Effect.gen(function* () {
      const request = yield* requestOf(Row);

      expect(schemaOf(request)).toEqual({
        type: "struct",
        fields: [
          { id: 1, name: "id", type: "string", required: true, doc: "Provider identifier." },
          { id: 2, name: "version", type: "long", required: true },
          { id: 3, name: "active", type: "boolean", required: false },
          { id: 4, name: "state", type: "string", required: true },
          {
            id: 5,
            name: "details",
            required: false,
            type: {
              type: "struct",
              fields: [
                {
                  id: 101,
                  name: "createdAt",
                  type: "timestamptz",
                  required: true,
                  doc: "Creation time.",
                },
                { id: 102, name: "payload", type: "binary", required: true },
                { id: 103, name: "score", type: "double", required: true },
                {
                  id: 104,
                  name: "labels",
                  required: true,
                  type: {
                    type: "list",
                    "element-id": 105,
                    element: "string",
                    "element-required": false,
                  },
                },
                {
                  id: 106,
                  name: "attributes",
                  required: true,
                  type: {
                    type: "map",
                    "key-id": 107,
                    key: "string",
                    "value-id": 108,
                    value: "double",
                    "value-required": false,
                  },
                },
              ],
            },
          },
        ],
      });

      expect(request).toEqual({
        requirements: [{ type: "assert-create" }],
        updates: [
          { action: "assign-uuid", uuid: "6d334acc-4a2d-4a1f-a66e-b39ba6bb90dd" },
          { action: "upgrade-format-version", "format-version": 2 },
          { action: "add-schema", schema: schemaOf(request) },
          { action: "set-current-schema", "schema-id": -1 },
          { action: "add-spec", spec: { "spec-id": 0, fields: [] } },
          { action: "set-default-spec", "spec-id": -1 },
          { action: "add-sort-order", "sort-order": { "order-id": 0, fields: [] } },
          { action: "set-default-sort-order", "sort-order-id": -1 },
          { action: "set-location", location: "s3://warehouse/rows" },
          { action: "set-properties", updates: { comment: "Connector rows." } },
        ],
      });
    });
  });

  it.effect("uses the decoded side of transformations", () => {
    const Input = Schema.Struct({ id: Schema.String.pipe(Iceberg.field(1)) });
    const Row = Input.pipe(
      Schema.decodeTo(
        Schema.Struct({
          ...Input.fields,
          version: Schema.String.pipe(Iceberg.field(2)),
        }),
        SchemaTransformation.transform({
          decode: ({ id }) => ({ id, version: "initial" }),
          encode: ({ id }) => ({ id }),
        }),
      ),
    );

    return Effect.gen(function* () {
      const request = yield* requestOf(Row);
      expect(schemaOf(request).fields.map(({ name }) => name)).toEqual(["id", "version"]);
    });
  });

  it.effect("merges properties and generates a UUID", () =>
    Effect.gen(function* () {
      const request = yield* Iceberg.makeCreateTableCommitRequest(
        Schema.Struct({ id: Schema.String.pipe(Iceberg.field(1)) }).annotate({
          description: "Rows.",
        }),
        {
          location: "s3://warehouse/rows",
          properties: { comment: "Override.", owner: "connectors" },
        },
      );
      const uuid = request.updates.find((update) => update.action === "assign-uuid");
      const properties = request.updates.find((update) => update.action === "set-properties");

      expect(uuid?.action === "assign-uuid" ? uuid.uuid : "").toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(properties?.action === "set-properties" ? properties.updates : {}).toEqual({
        comment: "Override.",
        owner: "connectors",
      });
    }),
  );

  it.effect("omits the location update when no location is given", () =>
    Effect.gen(function* () {
      const Row = Schema.Struct({ id: Schema.String.pipe(Iceberg.field(1)) });
      const withLocation = yield* requestOf(Row);
      const withoutLocation = yield* Iceberg.makeCreateTableCommitRequest(Row, {
        uuid: "6d334acc-4a2d-4a1f-a66e-b39ba6bb90dd",
      });

      expect(withoutLocation.updates).toEqual(
        withLocation.updates.filter((update) => update.action !== "set-location"),
      );
    }),
  );

  it.effect("rejects invalid IDs with their paths", () => {
    const nested = (fieldId?: number) =>
      Schema.Struct({
        child: Schema.String.pipe(Schema.annotateKey(fieldId === undefined ? {} : { fieldId })),
      });

    const cases: ReadonlyArray<readonly [Schema.Top, string, string]> = [
      [Schema.Struct({ id: Schema.String }), "$.id", "Missing fieldId"],
      [Schema.Struct({ id: Schema.String.pipe(Iceberg.field(0)) }), "$.id", "between 1"],
      [Schema.Struct({ id: Schema.String.pipe(Iceberg.field(1.5)) }), "$.id", "whole number"],
      [
        Schema.Struct({ id: Schema.String.pipe(Iceberg.field(2_147_483_448)) }),
        "$.id",
        "between 1",
      ],
      [Schema.Struct({ nested: nested().pipe(Iceberg.field(1)) }), "$.nested.child", "Missing"],
      [
        Schema.Struct({
          first: Schema.String.pipe(Iceberg.field(1)),
          second: Schema.String.pipe(Iceberg.field(1)),
        }),
        "$.second",
        "already used at $.first",
      ],
      [
        Schema.Struct({ values: Schema.Array(Schema.String).pipe(Iceberg.field(1)) }),
        "$.values.element",
        ".annotate({ fieldId })",
      ],
    ];

    return Effect.forEach(cases, ([schema, path, message]) =>
      errorOf(schema).pipe(
        Effect.map((error) => {
          expect(error.path).toBe(path);
          expect(error.message).toContain(message);
        }),
      ),
    );
  });

  it.effect("rejects recursive references", () => {
    interface Node {
      readonly children: ReadonlyArray<Node>;
    }

    const Node: Schema.Codec<Node> = Schema.Struct({
      children: Schema.Array(
        Schema.suspend((): Schema.Codec<Node> => Node).annotate({ fieldId: 102 }),
      ).pipe(Iceberg.field(101)),
    }).annotate({ identifier: "Node" });

    const Row = Schema.Struct({ node: Node.pipe(Iceberg.field(1)) });

    return Effect.gen(function* () {
      const error = yield* errorOf(Row);
      expect(error.path).toBe("$.node.children.element.children");
      expect(error.message).toContain("contains itself");
    });
  });

  it.effect("rejects unsupported schemas with precise paths", () => {
    const cases: ReadonlyArray<readonly [Schema.Top, string, string]> = [
      [Schema.String, "$", "top level of a table must be"],
      [
        Schema.Struct({ price: Schema.Number.pipe(Iceberg.field(1)) }),
        "$.price",
        "Plain Schema.Number",
      ],
      [
        Schema.Struct({
          value: Schema.Union([Schema.String, Schema.Finite]).pipe(Iceberg.field(1)),
        }),
        "$.value",
        "every member is a literal",
      ],
      [
        Schema.Struct({ value: Schema.Tuple([Schema.String]).pipe(Iceberg.field(1)) }),
        "$.value",
        "tuple does not work",
      ],
      [
        Schema.Struct({ value: Schema.Unknown.pipe(Iceberg.field(1)) }),
        "$.value",
        "Unknown schema does not work",
      ],
      [
        Schema.Struct({
          value: Schema.ReadonlyMap(
            Schema.NullOr(Schema.String).annotate({ fieldId: 101 }),
            Schema.String.annotate({ fieldId: 102 }),
          ).pipe(Iceberg.field(1)),
        }),
        "$.value.key",
        "Map keys cannot be null",
      ],
    ];

    return Effect.forEach(cases, ([schema, path, message]) =>
      errorOf(schema).pipe(
        Effect.map((error) => {
          expect(error.path).toBe(path);
          expect(error.message).toContain(message);
        }),
      ),
    );
  });
});
