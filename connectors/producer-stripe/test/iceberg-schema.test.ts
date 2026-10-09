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
          location: `s3://warehouse/stripe-${name}`,
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
            "charges": "Charges in a Stripe account.",
            "customers": "Customers in a Stripe account.",
            "invoices": "Invoices in a Stripe account. Deleted drafts are marked deleted.",
            "prices": "Prices in a Stripe account, including inactive ones.",
            "products": "Products in a Stripe account, including archived ones.",
            "refunds": "Refunds in a Stripe account.",
            "subscriptions": "Subscriptions in a Stripe account, including canceled ones.",
          },
          "missingDocs": [],
        }
      `);
      expect(tables).toMatchInlineSnapshot(`
        {
          "charges": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created: timestamptz",
            "4 livemode: boolean",
            "5 amount: long",
            "6 amount_captured: long",
            "7 amount_refunded: long",
            "8 currency: string",
            "9 status: string",
            "10 paid: boolean",
            "11 captured: boolean",
            "12 refunded: boolean",
            "13 disputed: boolean",
            "14 customer?: string",
            "15 payment_intent?: string",
            "16 payment_method?: string",
            "17 balance_transaction?: string",
            "18 description?: string",
            "19 failure_code?: string",
            "20 failure_message?: string",
            "21 payment_method_details?: struct<100 type: string, 101 card?: struct<102 brand?: string, 103 country?: string, 104 funding?: string, 105 last4?: string, 106 exp_month: long, 107 exp_year: long, 108 fingerprint?: string>>",
            "22 outcome?: struct<110 type: string, 111 network_status?: string, 112 reason?: string, 113 risk_level?: string, 114 seller_message?: string>",
            "23 metadata: map<200: string, 201: string>",
            "24 billing_details: struct<140 name?: string, 141 email?: string, 142 phone?: string, 143 address?: struct<144 line1?: string, 145 line2?: string, 146 city?: string, 147 state?: string, 148 postal_code?: string, 149 country?: string>>",
            "25 receipt_email?: string",
          ],
          "customers": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created: timestamptz",
            "4 livemode: boolean",
            "5 email?: string",
            "6 name?: string",
            "7 phone?: string",
            "8 description?: string",
            "9 currency?: string",
            "10 balance: long",
            "11 delinquent?: boolean",
            "12 tax_exempt?: string",
            "13 invoice_prefix?: string",
            "14 invoice_settings: struct<106 default_payment_method?: string>",
            "15 address?: struct<100 line1?: string, 101 line2?: string, 102 city?: string, 103 state?: string, 104 postal_code?: string, 105 country?: string>",
            "16 metadata: map<200: string, 201: string>",
            "17 _deleted?: boolean",
            "18 test_clock?: string",
            "19 shipping?: struct<110 name: string, 111 phone?: string, 112 address: struct<113 line1?: string, 114 line2?: string, 115 city?: string, 116 state?: string, 117 postal_code?: string, 118 country?: string>>",
          ],
          "invoices": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created: timestamptz",
            "4 livemode: boolean",
            "5 customer?: string",
            "6 customer_account?: string",
            "7 parent?: struct<100 type: string, 101 subscription_details?: struct<102 subscription: string>>",
            "8 status?: string",
            "9 number?: string",
            "10 currency: string",
            "11 subtotal: long",
            "12 total: long",
            "13 total_excluding_tax?: long",
            "14 amount_due: long",
            "15 amount_paid: long",
            "16 amount_remaining: long",
            "17 amount_overpaid: long",
            "18 attempt_count: long",
            "19 billing_reason?: string",
            "20 collection_method: string",
            "21 due_date?: timestamptz",
            "22 period_start: timestamptz",
            "23 period_end: timestamptz",
            "24 effective_at?: timestamptz",
            "25 status_transitions: struct<110 finalized_at?: timestamptz, 111 paid_at?: timestamptz, 112 voided_at?: timestamptz, 113 marked_uncollectible_at?: timestamptz>",
            "26 metadata: map<200: string, 201: string>",
            "27 _deleted?: boolean",
            "28 test_clock?: string",
            "29 customer_email?: string",
            "30 customer_name?: string",
            "31 customer_phone?: string",
            "32 customer_address?: struct<120 line1?: string, 121 line2?: string, 122 city?: string, 123 state?: string, 124 postal_code?: string, 125 country?: string>",
            "33 customer_shipping?: struct<130 name: string, 131 phone?: string, 132 address: struct<133 line1?: string, 134 line2?: string, 135 city?: string, 136 state?: string, 137 postal_code?: string, 138 country?: string>>",
          ],
          "prices": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created: timestamptz",
            "4 livemode: boolean",
            "5 active: boolean",
            "6 product: string",
            "7 currency: string",
            "8 type: string",
            "9 billing_scheme: string",
            "10 unit_amount?: long",
            "11 unit_amount_decimal?: string",
            "12 tiers_mode?: string",
            "13 lookup_key?: string",
            "14 nickname?: string",
            "15 tax_behavior?: string",
            "16 recurring?: struct<100 interval: string, 101 interval_count: long, 102 usage_type: string, 103 meter?: string, 104 trial_period_days?: long>",
            "17 metadata: map<200: string, 201: string>",
            "18 _deleted?: boolean",
          ],
          "products": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created: timestamptz",
            "4 updated: timestamptz",
            "5 livemode: boolean",
            "6 active: boolean",
            "7 name: string",
            "8 description?: string",
            "9 default_price?: string",
            "10 tax_code?: string",
            "11 unit_label?: string",
            "12 url?: string",
            "13 shippable?: boolean",
            "14 statement_descriptor?: string",
            "15 metadata: map<200: string, 201: string>",
            "16 _deleted?: boolean",
          ],
          "refunds": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created: timestamptz",
            "4 amount: long",
            "5 currency: string",
            "6 status?: string",
            "7 pending_reason?: string",
            "8 reason?: string",
            "9 failure_reason?: string",
            "10 charge?: string",
            "11 payment_intent?: string",
            "12 customer?: string",
            "13 customer_account?: string",
            "14 balance_transaction?: string",
            "15 metadata: map<200: string, 201: string>",
          ],
          "subscriptions": [
            "1 id: string",
            "2 version: timestamptz",
            "3 created: timestamptz",
            "4 livemode: boolean",
            "5 customer?: string",
            "6 customer_account?: string",
            "7 status: string",
            "8 currency: string",
            "9 collection_method: string",
            "10 start_date: timestamptz",
            "11 billing_cycle_anchor: timestamptz",
            "12 cancel_at?: timestamptz",
            "13 cancel_at_period_end: boolean",
            "14 canceled_at?: timestamptz",
            "15 ended_at?: timestamptz",
            "16 trial_start?: timestamptz",
            "17 trial_end?: timestamptz",
            "18 days_until_due?: long",
            "19 default_payment_method?: string",
            "20 latest_invoice?: string",
            "21 schedule?: string",
            "22 description?: string",
            "23 cancellation_details?: struct<100 reason?: string, 101 feedback?: string, 102 comment?: string>",
            "24 pause_collection?: struct<110 behavior: string, 111 resumes_at?: timestamptz>",
            "25 items: list<300: struct<301 id: string, 302 created: timestamptz, 303 price: struct<304 id: string, 305 product: string>, 306 quantity?: long, 307 current_period_start: timestamptz, 308 current_period_end: timestamptz>>",
            "26 metadata: map<200: string, 201: string>",
            "27 test_clock?: string",
          ],
        }
      `);
    }),
  );
});
