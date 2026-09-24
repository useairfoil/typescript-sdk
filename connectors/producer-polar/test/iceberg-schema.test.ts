import { describe, expect, it } from "@effect/vitest";
import { Iceberg } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import { CheckoutSchema, CustomerSchema, OrderSchema, SubscriptionSchema } from "../src/schemas";

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

describe("Polar Iceberg schemas", () => {
  it.effect("compiles every table with explicit IDs and docs", () =>
    Effect.gen(function* () {
      const schemas = [CustomerSchema, CheckoutSchema, OrderSchema, SubscriptionSchema];

      for (const [index, schema] of schemas.entries()) {
        const request = yield* Iceberg.makeCreateTableCommitRequest(schema, {
          location: `s3://warehouse/polar-${index}`,
          uuid: `00000000-0000-4000-8000-00000000000${index}`,
        });
        const properties = request.updates.find((update) => update.action === "set-properties");

        expect(properties?.action === "set-properties" && properties.updates.comment).toBeTruthy();
        expectDocs(tableSchema(request));
      }

      const customer = tableSchema(
        yield* Iceberg.makeCreateTableCommitRequest(CustomerSchema, {
          location: "s3://warehouse/customers",
          uuid: "00000000-0000-4000-8000-000000000001",
        }),
      );
      const order = tableSchema(
        yield* Iceberg.makeCreateTableCommitRequest(OrderSchema, {
          location: "s3://warehouse/orders",
          uuid: "00000000-0000-4000-8000-000000000002",
        }),
      );

      expect(
        customer.fields.filter((field) =>
          ["id", "created_at", "metadata", "version"].includes(field.name),
        ),
      ).toMatchInlineSnapshot(`
        [
          {
            "doc": "Unique customer identifier.",
            "id": 1,
            "name": "id",
            "required": true,
            "type": "string",
          },
          {
            "doc": "Time when the customer was created.",
            "id": 2,
            "name": "created_at",
            "required": true,
            "type": "timestamptz",
          },
          {
            "doc": "Customer metadata stored as JSON.",
            "id": 16,
            "name": "metadata",
            "required": true,
            "type": "string",
          },
          {
            "doc": "Time used to order customer changes.",
            "id": 17,
            "name": "version",
            "required": true,
            "type": "timestamptz",
          },
        ]
      `);

      expect(order.fields.find((field) => field.name === "items")?.type).toMatchObject({
        type: "list",
      });
    }),
  );
});
