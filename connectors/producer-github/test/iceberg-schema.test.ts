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
            "check_runs": "Check runs, such as GitHub Actions jobs. Polled for default-branch commits; webhooks cover all branches.",
            "commit_statuses": "Commit statuses. Polled for default-branch commits; webhooks cover all branches.",
            "commits": "Commits on the default branch of the installation's repositories.",
            "issue_comments": "Comments on issues and pull requests. Pull request review comments are not included.",
            "issues": "Issues in the installation's repositories. Pull requests are not included.",
            "pull_request_commits": "Commits in pull requests, up to 250 per pull request. Commits removed by a force push stay.",
            "pull_request_review_comments": "Review comments on pull request diffs.",
            "pull_request_reviews": "Reviews on pull requests. Pending reviews are only visible to their author.",
            "pull_requests": "Pull requests in the installation's repositories.",
            "releases": "Releases in the installation's repositories, with their assets.",
            "repositories": "Repositories the GitHub App installation can read.",
            "workflow_jobs": "Jobs of GitHub Actions workflow runs. Each run attempt has its own jobs.",
            "workflow_runs": "GitHub Actions workflow runs in the installation's repositories.",
          },
          "missingDocs": [],
        }
      `);
      expect(tables).toMatchInlineSnapshot(`
        {
          "check_runs": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 head_sha?: string",
            "6 name?: string",
            "7 status?: string",
            "8 conclusion?: string",
            "9 started_at?: timestamptz",
            "10 completed_at?: timestamptz",
            "11 app?: struct<100 id: long, 101 name: string>",
            "12 check_suite?: struct<102 id: long>",
            "13 output?: struct<103 title?: string, 104 summary?: string>",
            "14 external_id?: string",
            "15 details_url?: string",
            "16 html_url?: string",
          ],
          "commit_statuses": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 sha?: string",
            "6 state?: string",
            "7 context?: string",
            "8 description?: string",
            "9 target_url?: string",
            "10 creator?: struct<100 id: long, 101 login: string, 102 type: string>",
            "11 created_at?: timestamptz",
          ],
          "commits": [
            "1 key: string",
            "2 version?: timestamptz",
            "3 repository_id?: long",
            "4 sha?: string",
            "5 node_id?: string",
            "6 message?: string",
            "7 author?: struct<100 name: string, 101 date: timestamptz>",
            "8 committer?: struct<102 name: string, 103 date: timestamptz>",
            "9 author_user?: struct<104 id: long, 105 login: string, 106 type: string>",
            "10 committer_user?: struct<107 id: long, 108 login: string, 109 type: string>",
            "11 parents?: list<110: string>",
            "12 verified?: boolean",
            "13 html_url?: string",
          ],
          "issue_comments": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 issue_number?: long",
            "6 user?: struct<100 id: long, 101 login: string, 102 type: string>",
            "7 author_association?: string",
            "8 body?: string",
            "9 created_at?: timestamptz",
            "10 html_url?: string",
            "11 _deleted?: boolean",
          ],
          "issues": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 number?: long",
            "6 title?: string",
            "7 body?: string",
            "8 state?: string",
            "9 state_reason?: string",
            "10 locked?: boolean",
            "11 user?: struct<100 id: long, 101 login: string, 102 type: string>",
            "12 author_association?: string",
            "13 labels?: list<103: struct<104 id: long, 105 name: string>>",
            "14 assignees?: list<106: struct<107 id: long, 108 login: string, 109 type: string>>",
            "15 milestone?: struct<110 id: long, 111 number: long, 112 title: string>",
            "16 comments?: long",
            "17 created_at?: timestamptz",
            "18 closed_at?: timestamptz",
            "19 html_url?: string",
            "20 _deleted?: boolean",
          ],
          "pull_request_commits": [
            "1 key: string",
            "2 version?: timestamptz",
            "3 repository_id?: long",
            "4 pull_request_number?: long",
            "5 sha?: string",
            "6 message?: string",
            "7 author?: struct<100 name: string, 101 date: timestamptz>",
            "8 committer?: struct<102 name: string, 103 date: timestamptz>",
            "9 author_user?: struct<104 id: long, 105 login: string, 106 type: string>",
            "10 committer_user?: struct<107 id: long, 108 login: string, 109 type: string>",
            "11 html_url?: string",
          ],
          "pull_request_review_comments": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 pull_request_number?: long",
            "6 pull_request_review_id?: long",
            "7 in_reply_to_id?: long",
            "8 user?: struct<100 id: long, 101 login: string, 102 type: string>",
            "9 author_association?: string",
            "10 body?: string",
            "11 path?: string",
            "12 commit_id?: string",
            "13 original_commit_id?: string",
            "14 diff_hunk?: string",
            "15 line?: long",
            "16 original_line?: long",
            "17 start_line?: long",
            "18 side?: string",
            "19 subject_type?: string",
            "20 created_at?: timestamptz",
            "21 html_url?: string",
            "22 _deleted?: boolean",
          ],
          "pull_request_reviews": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 pull_request_number?: long",
            "6 user?: struct<100 id: long, 101 login: string, 102 type: string>",
            "7 author_association?: string",
            "8 state?: string",
            "9 body?: string",
            "10 commit_id?: string",
            "11 submitted_at?: timestamptz",
            "12 html_url?: string",
          ],
          "pull_requests": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 number?: long",
            "6 title?: string",
            "7 body?: string",
            "8 state?: string",
            "9 draft?: boolean",
            "10 locked?: boolean",
            "11 user?: struct<100 id: long, 101 login: string, 102 type: string>",
            "12 author_association?: string",
            "13 labels?: list<103: struct<104 id: long, 105 name: string>>",
            "14 assignees?: list<106: struct<107 id: long, 108 login: string, 109 type: string>>",
            "15 requested_reviewers?: list<110: struct<111 id: long, 112 login: string, 113 type: string>>",
            "16 milestone?: struct<114 id: long, 115 number: long, 116 title: string>",
            "17 head?: struct<117 ref: string, 118 sha: string, 119 label: string>",
            "18 base?: struct<120 ref: string, 121 sha: string, 122 label: string>",
            "19 created_at?: timestamptz",
            "20 closed_at?: timestamptz",
            "21 merged_at?: timestamptz",
            "22 html_url?: string",
          ],
          "releases": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 tag_name?: string",
            "6 target_commitish?: string",
            "7 name?: string",
            "8 body?: string",
            "9 draft?: boolean",
            "10 prerelease?: boolean",
            "11 author?: struct<100 id: long, 101 login: string, 102 type: string>",
            "12 assets?: list<103: struct<104 id: long, 105 name: string, 106 label?: string, 107 state: string, 108 content_type: string, 109 size: long, 110 download_count: long, 111 created_at: timestamptz, 112 updated_at: timestamptz, 113 browser_download_url: string>>",
            "13 created_at?: timestamptz",
            "14 published_at?: timestamptz",
            "15 html_url?: string",
            "16 _deleted?: boolean",
          ],
          "repositories": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 name?: string",
            "5 full_name?: string",
            "6 owner?: struct<100 id: long, 101 login: string, 102 type: string>",
            "7 private?: boolean",
            "8 visibility?: string",
            "9 description?: string",
            "10 fork?: boolean",
            "11 archived?: boolean",
            "12 disabled?: boolean",
            "13 default_branch?: string",
            "14 language?: string",
            "15 topics?: list<103: string>",
            "16 html_url?: string",
            "17 created_at?: timestamptz",
            "18 _deleted?: boolean",
          ],
          "workflow_jobs": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 run_id?: long",
            "6 run_attempt?: long",
            "7 workflow_name?: string",
            "8 name?: string",
            "9 head_sha?: string",
            "10 head_branch?: string",
            "11 status?: string",
            "12 conclusion?: string",
            "13 created_at?: timestamptz",
            "14 started_at?: timestamptz",
            "15 completed_at?: timestamptz",
            "16 runner_name?: string",
            "17 labels?: list<100: string>",
            "18 steps?: list<101: struct<102 number: long, 103 name: string, 104 status: string, 105 conclusion?: string, 106 started_at?: timestamptz, 107 completed_at?: timestamptz>>",
            "19 html_url?: string",
          ],
          "workflow_runs": [
            "1 id: long",
            "2 version?: timestamptz",
            "3 node_id?: string",
            "4 repository_id?: long",
            "5 workflow_id?: long",
            "6 name?: string",
            "7 display_title?: string",
            "8 path?: string",
            "9 event?: string",
            "10 status?: string",
            "11 conclusion?: string",
            "12 head_branch?: string",
            "13 head_sha?: string",
            "14 run_number?: long",
            "15 run_attempt?: long",
            "16 check_suite_id?: long",
            "17 actor?: struct<100 id: long, 101 login: string, 102 type: string>",
            "18 triggering_actor?: struct<103 id: long, 104 login: string, 105 type: string>",
            "19 pull_requests?: list<106: struct<107 id: long, 108 number: long>>",
            "20 created_at?: timestamptz",
            "21 run_started_at?: timestamptz",
            "22 html_url?: string",
          ],
        }
      `);
    }),
  );
});
