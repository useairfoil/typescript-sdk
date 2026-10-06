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
          location: `s3://warehouse/github-${name}`,
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
            "issue_comments": "Comments on issues and pull requests. Pull request review comments are not included.",
            "issues": "Issues in the installation's repositories. Pull requests are not included.",
            "pull_requests": "Pull requests in the installation's repositories.",
            "repositories": "Repositories the GitHub App installation can read.",
          },
          "missingDocs": [],
        }
      `);
      expect(tables).toMatchInlineSnapshot(`
        {
          "issue_comments": [
            "1 id: long",
            "2 version: timestamptz",
            "3 node_id: string",
            "4 repository_id: long",
            "5 issue_number: long",
            "6 user?: struct<100 id: long, 101 login: string, 102 type: string>",
            "7 author_association: string",
            "8 body: string",
            "9 created_at: timestamptz",
            "10 html_url: string",
            "11 _deleted?: boolean",
          ],
          "issues": [
            "1 id: long",
            "2 version: timestamptz",
            "3 node_id: string",
            "4 repository_id: long",
            "5 number: long",
            "6 title: string",
            "7 body: string",
            "8 state: string",
            "9 state_reason?: string",
            "10 locked: boolean",
            "11 user?: struct<100 id: long, 101 login: string, 102 type: string>",
            "12 author_association: string",
            "13 labels: list<103: struct<104 id: long, 105 name: string>>",
            "14 assignees: list<106: struct<107 id: long, 108 login: string, 109 type: string>>",
            "15 milestone?: struct<110 id: long, 111 number: long, 112 title: string>",
            "16 comments: long",
            "17 created_at: timestamptz",
            "18 closed_at?: timestamptz",
            "19 html_url: string",
            "20 _deleted?: boolean",
          ],
          "pull_requests": [
            "1 id: long",
            "2 version: timestamptz",
            "3 node_id: string",
            "4 repository_id: long",
            "5 number: long",
            "6 title: string",
            "7 body: string",
            "8 state: string",
            "9 draft?: boolean",
            "10 locked: boolean",
            "11 user?: struct<100 id: long, 101 login: string, 102 type: string>",
            "12 author_association: string",
            "13 labels: list<103: struct<104 id: long, 105 name: string>>",
            "14 assignees: list<106: struct<107 id: long, 108 login: string, 109 type: string>>",
            "15 requested_reviewers: list<110: struct<111 id: long, 112 login: string, 113 type: string>>",
            "16 milestone?: struct<114 id: long, 115 number: long, 116 title: string>",
            "17 head: struct<117 ref: string, 118 sha: string, 119 label: string>",
            "18 base: struct<120 ref: string, 121 sha: string, 122 label: string>",
            "19 created_at: timestamptz",
            "20 closed_at?: timestamptz",
            "21 merged_at?: timestamptz",
            "22 html_url: string",
          ],
          "repositories": [
            "1 id: long",
            "2 version: timestamptz",
            "3 node_id: string",
            "4 name: string",
            "5 full_name: string",
            "6 owner: struct<100 id: long, 101 login: string, 102 type: string>",
            "7 private: boolean",
            "8 visibility?: string",
            "9 description: string",
            "10 fork: boolean",
            "11 archived: boolean",
            "12 disabled: boolean",
            "13 default_branch: string",
            "14 language?: string",
            "15 topics: list<103: string>",
            "16 html_url: string",
            "17 created_at: timestamptz",
            "18 _deleted?: boolean",
          ],
        }
      `);
    }),
  );
});
