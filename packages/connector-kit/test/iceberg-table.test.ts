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

      expect(schemaOf(request)).toMatchInlineSnapshot(`
        {
          "fields": [
            {
              "doc": "Provider identifier.",
              "id": 1,
              "name": "id",
              "required": true,
              "type": "string",
            },
            {
              "id": 2,
              "name": "version",
              "required": true,
              "type": "long",
            },
            {
              "id": 3,
              "name": "active",
              "required": false,
              "type": "boolean",
            },
            {
              "id": 4,
              "name": "state",
              "required": true,
              "type": "string",
            },
            {
              "id": 5,
              "name": "details",
              "required": false,
              "type": {
                "fields": [
                  {
                    "doc": "Creation time.",
                    "id": 101,
                    "name": "createdAt",
                    "required": true,
                    "type": "timestamptz",
                  },
                  {
                    "id": 102,
                    "name": "payload",
                    "required": true,
                    "type": "binary",
                  },
                  {
                    "id": 103,
                    "name": "score",
                    "required": true,
                    "type": "double",
                  },
                  {
                    "id": 104,
                    "name": "labels",
                    "required": true,
                    "type": {
                      "element": "string",
                      "element-id": 105,
                      "element-required": false,
                      "type": "list",
                    },
                  },
                  {
                    "id": 106,
                    "name": "attributes",
                    "required": true,
                    "type": {
                      "key": "string",
                      "key-id": 107,
                      "type": "map",
                      "value": "double",
                      "value-id": 108,
                      "value-required": false,
                    },
                  },
                ],
                "type": "struct",
              },
            },
          ],
          "type": "struct",
        }
      `);

      expect({
        ...request,
        updates: request.updates.map((update) =>
          update.action === "add-schema" ? { action: update.action } : update,
        ),
      }).toMatchInlineSnapshot(`
        {
          "requirements": [
            {
              "type": "assert-create",
            },
          ],
          "updates": [
            {
              "action": "assign-uuid",
              "uuid": "6d334acc-4a2d-4a1f-a66e-b39ba6bb90dd",
            },
            {
              "action": "upgrade-format-version",
              "format-version": 2,
            },
            {
              "action": "add-schema",
            },
            {
              "action": "set-current-schema",
              "schema-id": -1,
            },
            {
              "action": "add-spec",
              "spec": {
                "fields": [],
                "spec-id": 0,
              },
            },
            {
              "action": "set-default-spec",
              "spec-id": -1,
            },
            {
              "action": "add-sort-order",
              "sort-order": {
                "fields": [],
                "order-id": 0,
              },
            },
            {
              "action": "set-default-sort-order",
              "sort-order-id": -1,
            },
            {
              "action": "set-location",
              "location": "s3://warehouse/rows",
            },
            {
              "action": "set-properties",
              "updates": {
                "comment": "Connector rows.",
              },
            },
          ],
        }
      `);
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

    const cases: ReadonlyArray<Schema.Top> = [
      Schema.Struct({ id: Schema.String }),
      Schema.Struct({ id: Schema.String.pipe(Iceberg.field(0)) }),
      Schema.Struct({ id: Schema.String.pipe(Iceberg.field(1.5)) }),
      Schema.Struct({ id: Schema.String.pipe(Iceberg.field(2_147_483_448)) }),
      Schema.Struct({ nested: nested().pipe(Iceberg.field(1)) }),
      Schema.Struct({
        first: Schema.String.pipe(Iceberg.field(1)),
        second: Schema.String.pipe(Iceberg.field(1)),
      }),
      Schema.Struct({ values: Schema.Array(Schema.String).pipe(Iceberg.field(1)) }),
    ];

    return Effect.gen(function* () {
      const errors = yield* Effect.forEach(cases, errorOf);
      expect(errors.map(({ path, message }) => ({ path, message }))).toMatchInlineSnapshot(`
        [
          {
            "message": "Missing fieldId; add it with Iceberg.field(id)",
            "path": "$.id",
          },
          {
            "message": "fieldId must be between 1 and 2147483447",
            "path": "$.id",
          },
          {
            "message": "fieldId must be a whole number",
            "path": "$.id",
          },
          {
            "message": "fieldId must be between 1 and 2147483447",
            "path": "$.id",
          },
          {
            "message": "Missing fieldId; add it with Iceberg.field(id)",
            "path": "$.nested.child",
          },
          {
            "message": "fieldId 1 is already used at $.first",
            "path": "$.second",
          },
          {
            "message": "Missing fieldId; add it with .annotate({ fieldId }) on the schema itself",
            "path": "$.values.element",
          },
        ]
      `);
    });
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
      const { path, message } = yield* errorOf(Row);
      expect({ path, message }).toMatchInlineSnapshot(`
        {
          "message": "Iceberg cannot store a schema that contains itself",
          "path": "$.node.children.element.children",
        }
      `);
    });
  });

  it.effect("rejects unsupported schemas with precise paths", () => {
    const cases: ReadonlyArray<Schema.Top> = [
      Schema.String,
      Schema.Struct({ price: Schema.Number.pipe(Iceberg.field(1)) }),
      Schema.Struct({
        value: Schema.Union([Schema.String, Schema.Finite]).pipe(Iceberg.field(1)),
      }),
      Schema.Struct({ value: Schema.Tuple([Schema.String]).pipe(Iceberg.field(1)) }),
      Schema.Struct({ value: Schema.Unknown.pipe(Iceberg.field(1)) }),
      Schema.Struct({
        value: Schema.ReadonlyMap(
          Schema.NullOr(Schema.String).annotate({ fieldId: 101 }),
          Schema.String.annotate({ fieldId: 102 }),
        ).pipe(Iceberg.field(1)),
      }),
    ];

    return Effect.gen(function* () {
      const errors = yield* Effect.forEach(cases, errorOf);
      expect(errors.map(({ path, message }) => ({ path, message }))).toMatchInlineSnapshot(`
        [
          {
            "message": "The top level of a table must be a Schema.Struct",
            "path": "$",
          },
          {
            "message": "Plain Schema.Number does not work here; use Schema.Finite or Schema.Int",
            "path": "$.price",
          },
          {
            "message": "A union only works when every member is a literal",
            "path": "$.value",
          },
          {
            "message": "A tuple does not work here; use a Schema.Array where every item has the same type",
            "path": "$.value",
          },
          {
            "message": "A Unknown schema does not work here",
            "path": "$.value",
          },
          {
            "message": "Map keys cannot be null",
            "path": "$.value.key",
          },
        ]
      `);
    });
  });
});
