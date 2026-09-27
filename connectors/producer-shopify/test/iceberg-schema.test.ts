import { describe, expect, it } from "@effect/vitest";
import { Iceberg } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import { CartSchema } from "../src/resources/carts/row";
import { ProductSchema } from "../src/resources/products/row";
import { tableSchemas } from "../src/tables";

type CommitRequest = Effect.Success<ReturnType<typeof Iceberg.makeCreateTableCommitRequest>>;
type AddSchema = Extract<CommitRequest["updates"][number], { readonly action: "add-schema" }>;
type TableSchema = AddSchema["schema"];
type StructField = TableSchema["fields"][number];
type IcebergType = StructField["type"];

const tableSchema = (request: CommitRequest): TableSchema => {
  const update = request.updates.find((update) => update.action === "add-schema");
  if (update?.action !== "add-schema") throw new Error("Missing add-schema update");
  return update.schema;
};

const fieldAt = (schema: TableSchema, name: string): StructField => {
  const field = schema.fields.find((field) => field.name === name);
  if (field === undefined) throw new Error(`Missing field ${name}`);
  return field;
};

const expectDocs = (type: IcebergType): void => {
  if (typeof type === "string") return;

  switch (type.type) {
    case "struct":
      for (const field of type.fields) {
        expect(field.doc).toBeTruthy();
        expectDocs(field.type);
      }
      return;
    case "list":
      expectDocs(type.element);
      return;
    case "map":
      expectDocs(type.key);
      expectDocs(type.value);
      return;
  }
};

describe("Shopify Iceberg schemas", () => {
  it.effect("compiles every table with explicit IDs and docs", () =>
    Effect.gen(function* () {
      const productRequest = yield* Iceberg.makeCreateTableCommitRequest(ProductSchema, {
        location: "s3://warehouse/products",
        uuid: "00000000-0000-4000-8000-000000000001",
      });
      const cartRequest = yield* Iceberg.makeCreateTableCommitRequest(CartSchema, {
        location: "s3://warehouse/carts",
        uuid: "00000000-0000-4000-8000-000000000002",
      });
      const product = tableSchema(productRequest);
      const cart = tableSchema(cartRequest);

      for (const [name, schema] of Object.entries(tableSchemas)) {
        const request = yield* Iceberg.makeCreateTableCommitRequest(schema, {
          location: `s3://warehouse/${name}`,
          uuid: "00000000-0000-4000-8000-000000000003",
        });
        expectDocs(tableSchema(request));
      }
      expect(productRequest.updates).toContainEqual({
        action: "set-properties",
        updates: { comment: "Products in a Shopify store." },
      });
      expect(cartRequest.updates).toContainEqual({
        action: "set-properties",
        updates: { comment: "Latest state of each cart in a Shopify store." },
      });

      expect(product.fields.filter((field) => ["createdAt", "featuredMedia"].includes(field.name)))
        .toMatchInlineSnapshot(`
        [
          {
            "doc": "Time when the product was created.",
            "id": 10,
            "name": "createdAt",
            "required": true,
            "type": "timestamptz",
          },
          {
            "doc": "Featured media for the product.",
            "id": 14,
            "name": "featuredMedia",
            "required": false,
            "type": {
              "fields": [
                {
                  "doc": "Image for the featured media.",
                  "id": 201,
                  "name": "image",
                  "required": false,
                  "type": {
                    "fields": [
                      {
                        "doc": "URL of the image.",
                        "id": 202,
                        "name": "url",
                        "required": true,
                        "type": "string",
                      },
                      {
                        "doc": "Alternative text for the image.",
                        "id": 203,
                        "name": "altText",
                        "required": false,
                        "type": "string",
                      },
                    ],
                    "type": "struct",
                  },
                },
              ],
              "type": "struct",
            },
          },
        ]
      `);

      const lineItems = fieldAt(cart, "lineItems").type;
      if (typeof lineItems === "string" || lineItems.type !== "list") {
        throw new Error("lineItems is not a list");
      }
      if (typeof lineItems.element === "string" || lineItems.element.type !== "struct") {
        throw new Error("lineItems element is not a struct");
      }

      expect(lineItems.element.fields.filter((field) => ["id", "properties"].includes(field.name)))
        .toMatchInlineSnapshot(`
        [
          {
            "doc": "Unique cart line identifier.",
            "id": 102,
            "name": "id",
            "required": true,
            "type": "string",
          },
          {
            "doc": "Custom line properties stored as JSON.",
            "id": 103,
            "name": "properties",
            "required": false,
            "type": "string",
          },
        ]
      `);
    }),
  );
});
