import { describe, expect, it } from "@effect/vitest";
import { Iceberg } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import { tableSchemas } from "../src/tables";

type CommitRequest = Effect.Success<ReturnType<typeof Iceberg.makeCreateTableCommitRequest>>;
type AddSchema = Extract<CommitRequest["updates"][number], { readonly action: "add-schema" }>;
type TableSchema = AddSchema["schema"];
type IcebergType = TableSchema["fields"][number]["type"];

const tableSchema = (request: CommitRequest): TableSchema => {
  const update = request.updates.find((item) => item.action === "add-schema");
  if (update?.action !== "add-schema") throw new Error("Missing add-schema update");
  return update.schema;
};

const undocumented = (type: IcebergType): ReadonlyArray<string> => {
  if (typeof type === "string") return [];
  switch (type.type) {
    case "struct":
      return type.fields.flatMap((field) => [
        ...(field.doc ? [] : [field.name]),
        ...undocumented(field.type),
      ]);
    case "list":
      return undocumented(type.element);
    case "map":
      return [...undocumented(type.key), ...undocumented(type.value)];
  }
};

const describeType = (type: IcebergType): string => {
  if (typeof type === "string") return type;
  switch (type.type) {
    case "struct":
      return `struct<${type.fields.map((field) => `${field.id} ${field.name}${field.required ? "" : "?"}: ${describeType(field.type)}`).join(", ")}>`;
    case "list":
      return `list<${type["element-id"]}: ${describeType(type.element)}>`;
    case "map":
      return `map<${type["key-id"]}: ${describeType(type.key)}, ${type["value-id"]}: ${describeType(type.value)}>`;
  }
};

describe("Iceberg schemas", () => {
  it.effect("compiles every table with documented, stable field IDs", () =>
    Effect.gen(function* () {
      const comments: Record<string, string | undefined> = {};
      const missingDocs: Array<string> = [];
      const tables: Record<string, ReadonlyArray<string>> = {};
      for (const [name, schema] of Object.entries(tableSchemas)) {
        const request = yield* Iceberg.makeCreateTableCommitRequest(schema, {
          location: `s3://warehouse/hubspot-${name}`,
        });
        const properties = request.updates.find((update) => update.action === "set-properties");
        comments[name] =
          properties?.action === "set-properties" ? properties.updates.comment : undefined;

        const fields = tableSchema(request);
        missingDocs.push(...undocumented(fields).map((field) => `${name}.${field}`));
        tables[name] = fields.fields.map(
          (field) =>
            `${field.id} ${field.name}${field.required ? "" : "?"}: ${describeType(field.type)}`,
        );
      }

      expect({ comments, missingDocs }).toMatchInlineSnapshot(`
        {
          "comments": {
            "calls": "Calls logged in HubSpot.",
            "companies": "HubSpot companies. Their contacts and deals are on those tables.",
            "contacts": "HubSpot contacts.",
            "deals": "HubSpot deals.",
            "emails": "One-to-one emails logged in HubSpot.",
            "line_items": "Line items on HubSpot deals. The product is \`hs_product_id\` in \`properties\`.",
            "meetings": "Meetings logged in HubSpot.",
            "notes": "Notes on HubSpot records.",
            "owners": "HubSpot users and queues that can own records.",
            "pipelines": "Deal and ticket pipelines with their stages.",
            "products": "HubSpot product library.",
            "tasks": "HubSpot tasks.",
            "tickets": "HubSpot tickets.",
          },
          "missingDocs": [],
        }
      `);
      expect(tables).toMatchInlineSnapshot(`
        {
          "calls": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids: list<103: string>",
            "8 contact_ids: list<104: string>",
            "9 deal_ids: list<105: string>",
            "10 ticket_ids: list<106: string>",
          ],
          "companies": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "contacts": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids: list<103: string>",
          ],
          "deals": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids: list<103: string>",
            "8 contact_ids: list<104: string>",
          ],
          "emails": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids: list<103: string>",
            "8 contact_ids: list<104: string>",
            "9 deal_ids: list<105: string>",
            "10 ticket_ids: list<106: string>",
          ],
          "line_items": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "9 deal_ids: list<105: string>",
          ],
          "meetings": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids: list<103: string>",
            "8 contact_ids: list<104: string>",
            "9 deal_ids: list<105: string>",
            "10 ticket_ids: list<106: string>",
          ],
          "notes": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids: list<103: string>",
            "8 contact_ids: list<104: string>",
            "9 deal_ids: list<105: string>",
            "10 ticket_ids: list<106: string>",
          ],
          "owners": [
            "1 id: string",
            "2 version: timestamptz",
            "3 type: string",
            "4 email?: string",
            "5 first_name?: string",
            "6 last_name?: string",
            "7 user_id?: long",
            "8 user_id_including_inactive?: long",
            "9 teams: list<101: struct<102 id: string, 103 name: string, 104 primary: boolean>>",
            "10 archived: boolean",
            "11 created_at: timestamptz",
          ],
          "pipelines": [
            "1 key: string",
            "2 version: timestamptz",
            "3 object_type: string",
            "4 id: string",
            "5 label: string",
            "6 display_order: long",
            "7 archived: boolean",
            "8 stages: list<101: struct<102 id: string, 103 label: string, 104 display_order: long, 105 archived: boolean, 106 metadata: map<107: string, 108: string>>>",
            "9 created_at: timestamptz",
          ],
          "products": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "tasks": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids: list<103: string>",
            "8 contact_ids: list<104: string>",
            "9 deal_ids: list<105: string>",
            "10 ticket_ids: list<106: string>",
          ],
          "tickets": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 properties: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids: list<103: string>",
            "8 contact_ids: list<104: string>",
            "9 deal_ids: list<105: string>",
          ],
        }
      `);
    }),
  );
});
