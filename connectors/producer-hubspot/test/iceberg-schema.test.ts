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
            "carts": "HubSpot carts.",
            "commerce_payments": "Payments collected through HubSpot.",
            "communications": "SMS, WhatsApp, and LinkedIn messages logged in HubSpot.",
            "companies": "HubSpot companies. Their contacts and deals are on those tables.",
            "contacts": "HubSpot contacts.",
            "custom_objects": "Records of every custom object type in one table.",
            "deal_split": "How deal amounts are split between owners.",
            "deals": "HubSpot deals.",
            "discounts": "Discounts on HubSpot quotes.",
            "emails": "One-to-one emails logged in HubSpot.",
            "feedback_submissions": "Answers to HubSpot feedback surveys.",
            "fees": "Fees on HubSpot quotes.",
            "goal_targets": "HubSpot goals.",
            "invoices": "HubSpot invoices.",
            "leads": "HubSpot leads.",
            "line_items": "Line items on HubSpot deals. The product is \`hs_product_id\` in \`properties\`.",
            "lists": "HubSpot lists (segments), without their members.",
            "meetings": "Meetings logged in HubSpot.",
            "notes": "Notes on HubSpot records.",
            "orders": "HubSpot orders.",
            "owners": "HubSpot users and queues that can own records.",
            "pipelines": "Pipelines with their stages, for deals, tickets, leads, orders, and custom objects.",
            "postal_mail": "Postal mail logged in HubSpot.",
            "products": "HubSpot product library.",
            "properties": "Property definitions that name the keys and values in \`properties\`.",
            "quotes": "HubSpot quotes.",
            "subscriptions": "Recurring payment subscriptions in HubSpot.",
            "tasks": "HubSpot tasks.",
            "taxes": "Taxes on HubSpot quotes.",
            "teams": "HubSpot teams and their users.",
            "tickets": "HubSpot tickets.",
            "users": "HubSpot users with their user properties. \`owners\` maps them to owner IDs.",
          },
          "missingDocs": [],
        }
      `);
      expect(tables).toMatchInlineSnapshot(`
        {
          "calls": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
          ],
          "carts": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
          ],
          "commerce_payments": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
          ],
          "communications": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
          ],
          "companies": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "contacts": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
          ],
          "custom_objects": [
            "11 key: string",
            "1 id?: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
            "12 object_type_id?: string",
            "13 object_type?: string",
          ],
          "deal_split": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "9 deal_ids?: list<105: string>",
          ],
          "deals": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
          ],
          "discounts": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "emails": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
          ],
          "feedback_submissions": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
          ],
          "fees": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "goal_targets": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "invoices": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
          ],
          "leads": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
          ],
          "line_items": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "9 deal_ids?: list<105: string>",
          ],
          "lists": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 name?: string",
            "4 object_type_id?: string",
            "5 processing_type?: string",
            "6 processing_status?: string",
            "7 size?: long",
            "8 created_at?: timestamptz",
            "9 updated_at?: timestamptz",
            "10 filters_updated_at?: timestamptz",
          ],
          "meetings": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
          ],
          "notes": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
          ],
          "orders": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
          ],
          "owners": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 type?: string",
            "4 email?: string",
            "5 first_name?: string",
            "6 last_name?: string",
            "7 user_id?: long",
            "8 user_id_including_inactive?: long",
            "9 teams?: list<101: struct<102 id: string, 103 name: string, 104 primary: boolean>>",
            "10 archived?: boolean",
            "11 created_at?: timestamptz",
          ],
          "pipelines": [
            "1 key: string",
            "2 version?: timestamptz",
            "3 object_type?: string",
            "4 id?: string",
            "5 label?: string",
            "6 display_order?: long",
            "7 archived?: boolean",
            "8 stages?: list<101: struct<102 id: string, 103 label: string, 104 display_order: long, 105 archived: boolean, 106 metadata: map<107: string, 108: string>>>",
            "9 created_at?: timestamptz",
          ],
          "postal_mail": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
          ],
          "products": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "properties": [
            "1 key: string",
            "2 version?: timestamptz",
            "3 object_type?: string",
            "4 name?: string",
            "5 label?: string",
            "6 type?: string",
            "7 field_type?: string",
            "8 description?: string",
            "9 group_name?: string",
            "10 options?: list<101: struct<102 label: string, 103 value: string, 104 display_order: long, 105 hidden: boolean>>",
            "11 calculated?: boolean",
            "12 hidden?: boolean",
            "13 hubspot_defined?: boolean",
            "14 archived?: boolean",
            "15 created_at?: timestamptz",
            "16 updated_at?: timestamptz",
          ],
          "quotes": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
          ],
          "subscriptions": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
          ],
          "tasks": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
            "10 ticket_ids?: list<106: string>",
          ],
          "taxes": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "teams": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 name?: string",
            "4 parent_team_id?: string",
            "5 members?: list<101: struct<102 user_id: string, 103 type: string>>",
          ],
          "tickets": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 company_ids?: list<103: string>",
            "8 contact_ids?: list<104: string>",
            "9 deal_ids?: list<105: string>",
          ],
          "users": [
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 properties?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
        }
      `);
    }),
  );
});
