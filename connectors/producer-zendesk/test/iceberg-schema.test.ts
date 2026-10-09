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
          location: `s3://warehouse/zendesk-${name}`,
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
            "brands": "Zendesk brands.",
            "csat_surveys": "Zendesk CSAT surveys. Names the IDs in \`survey_responses\`.",
            "custom_statuses": "Zendesk ticket statuses. Names \`tickets.custom_status_id\`.",
            "groups": "Zendesk agent groups.",
            "organizations": "Zendesk organizations, usually customer companies.",
            "survey_responses": "Answers to Zendesk CSAT surveys. Unanswered surveys are left out.",
            "ticket_comments": "Comments and internal notes on Zendesk tickets.",
            "ticket_fields": "Zendesk ticket fields. Names the IDs in \`tickets.custom_fields\`.",
            "ticket_forms": "Zendesk ticket forms.",
            "tickets": "Zendesk tickets, with their metrics.",
            "users": "Zendesk users: end users, agents, and admins.",
          },
          "missingDocs": [],
        }
      `);
      expect(tables).toMatchInlineSnapshot(`
        {
          "brands": [
            "1 id: long",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 name: string",
            "6 subdomain: string",
            "7 brand_url: string",
            "8 active: boolean",
            "9 default: boolean",
          ],
          "csat_surveys": [
            "1 id: string",
            "2 version: timestamptz",
            "3 survey_version: long",
            "4 state: string",
            "5 created_at: timestamptz",
            "6 updated_at: timestamptz",
            "7 questions: list<101: struct<102 id: string, 103 type: string, 104 sub_type?: string, 105 headline: string, 110 options: list<106: struct<107 id?: string, 108 rating?: long, 109 label: string>>>>",
          ],
          "custom_statuses": [
            "1 id: long",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 status_category: string",
            "6 agent_label: string",
            "7 end_user_label: string",
            "8 active: boolean",
            "9 default: boolean",
          ],
          "groups": [
            "1 id: long",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 name: string",
            "6 description: string",
            "7 default: boolean",
            "8 is_public: boolean",
          ],
          "organizations": [
            "1 id: long",
            "2 version: timestamptz",
            "3 _deleted?: boolean",
            "4 created_at: timestamptz",
            "5 updated_at: timestamptz",
            "6 name: string",
            "7 external_id?: string",
            "8 group_id?: long",
            "9 domain_names: list<101: string>",
            "10 tags: list<102: string>",
            "11 organization_fields: map<103: string, 104: string>",
          ],
          "survey_responses": [
            "1 id: string",
            "2 version: timestamptz",
            "3 ticket_id?: long",
            "4 responder_id: long",
            "5 survey_id: string",
            "6 survey_version: long",
            "7 rating?: long",
            "8 rating_category?: string",
            "9 answers: list<101: struct<102 question_id: string, 103 question_type: string, 104 type: string, 105 rating?: long, 106 rating_category?: string, 107 value?: string, 109 option_ids: list<108: string>, 110 updated_at: timestamptz>>",
            "10 expires_at: timestamptz",
          ],
          "ticket_comments": [
            "1 id: long",
            "2 version: timestamptz",
            "3 ticket_id: long",
            "4 type: string",
            "5 author_id: long",
            "6 public: boolean",
            "7 created_at: timestamptz",
            "8 via: struct<101 channel: string>",
            "9 body: string",
            "10 attachments: list<102: struct<103 id: long, 104 file_name: string, 105 content_type: string, 106 size: long>>",
          ],
          "ticket_fields": [
            "1 id: long",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 type: string",
            "6 title: string",
            "7 raw_title: string",
            "8 active: boolean",
            "9 required: boolean",
            "10 custom_field_options: list<101: struct<102 id: long, 103 name: string, 104 value: string>>",
          ],
          "ticket_forms": [
            "1 id: long",
            "2 version: timestamptz",
            "3 created_at: timestamptz",
            "4 updated_at: timestamptz",
            "5 name: string",
            "6 display_name: string",
            "7 active: boolean",
            "8 default: boolean",
            "9 ticket_field_ids: list<101: long>",
          ],
          "tickets": [
            "1 id: long",
            "2 version: timestamptz",
            "3 _deleted?: boolean",
            "4 created_at: timestamptz",
            "5 updated_at: timestamptz",
            "6 subject?: string",
            "7 description?: string",
            "8 status: string",
            "9 custom_status_id?: long",
            "10 priority?: string",
            "11 type?: string",
            "12 via: struct<101 channel: string>",
            "13 requester_id?: long",
            "14 submitter_id?: long",
            "15 assignee_id?: long",
            "16 organization_id?: long",
            "17 group_id?: long",
            "18 brand_id?: long",
            "19 ticket_form_id?: long",
            "20 problem_id?: long",
            "21 due_at?: timestamptz",
            "22 external_id?: string",
            "23 is_public: boolean",
            "24 satisfaction_rating?: struct<102 score: string, 103 comment?: string>",
            "25 tags: list<104: string>",
            "26 custom_fields: map<105: string, 106: string>",
            "27 metrics?: struct<110 replies: long, 111 reopens: long, 112 assignee_stations: long, 113 group_stations: long, 116 reply_time_in_minutes: struct<114 calendar?: long, 115 business?: long>, 119 first_resolution_time_in_minutes: struct<117 calendar?: long, 118 business?: long>, 122 full_resolution_time_in_minutes: struct<120 calendar?: long, 121 business?: long>, 125 agent_wait_time_in_minutes: struct<123 calendar?: long, 124 business?: long>, 128 requester_wait_time_in_minutes: struct<126 calendar?: long, 127 business?: long>, 131 on_hold_time_in_minutes: struct<129 calendar?: long, 130 business?: long>, 132 assigned_at?: timestamptz, 133 initially_assigned_at?: timestamptz, 134 solved_at?: timestamptz, 135 latest_comment_added_at?: timestamptz, 136 status_updated_at?: timestamptz>",
          ],
          "users": [
            "1 id: long",
            "2 version: timestamptz",
            "3 _deleted?: boolean",
            "4 created_at: timestamptz",
            "5 updated_at: timestamptz",
            "6 name: string",
            "7 email?: string",
            "8 role: string",
            "9 custom_role_id?: long",
            "10 organization_id?: long",
            "11 default_group_id?: long",
            "12 suspended: boolean",
            "13 verified: boolean",
            "14 locale?: string",
            "15 time_zone?: string",
            "16 external_id?: string",
            "17 last_login_at?: timestamptz",
            "18 tags: list<101: string>",
            "19 user_fields: map<102: string, 103: string>",
          ],
        }
      `);
    }),
  );
});
