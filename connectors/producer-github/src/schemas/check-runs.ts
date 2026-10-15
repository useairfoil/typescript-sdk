import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, field, readVersion } from "./shared";

export const CheckRunSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique check run ID.")),
  version: readVersion(2, "check run"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the check run.")),
  repository_id: Long.pipe(field(4, "ID of the repository the check run belongs to.")),
  head_sha: Schema.String.pipe(field(5, "SHA of the commit the check ran on.")),
  name: Schema.String.pipe(field(6, "Check name.")),
  status: Schema.String.pipe(field(7, "Status, such as queued, in_progress, or completed.")),
  conclusion: Schema.NullOr(Schema.String).pipe(
    field(8, "Result of a completed check, such as success or failure."),
  ),
  started_at: Schema.NullOr(Timestamp).pipe(field(9, "Time the check started.")),
  completed_at: Schema.NullOr(Timestamp).pipe(field(10, "Time the check completed.")),
  app: Schema.NullOr(
    Schema.Struct({
      id: Long.pipe(field(100, "GitHub App ID.")),
      name: Schema.String.pipe(field(101, "GitHub App name.")),
    }),
  ).pipe(field(11, "GitHub App that created the check, such as GitHub Actions.")),
  check_suite: Schema.NullOr(Schema.Struct({ id: Long.pipe(field(102, "Check suite ID.")) })).pipe(
    field(12, "Check suite the check run belongs to."),
  ),
  output: Schema.Struct({
    title: Schema.NullOr(Schema.String).pipe(field(103, "Output title.")),
    summary: Schema.NullOr(Schema.String).pipe(field(104, "Output summary in Markdown.")),
  }).pipe(field(13, "Output the check reported.")),
  external_id: Schema.NullOr(Schema.String).pipe(field(14, "ID the app gave the check.")),
  details_url: Schema.NullOr(Schema.String).pipe(field(15, "Details page from the app.")),
  html_url: Schema.NullOr(Schema.String).pipe(field(16, "Check run page on GitHub.")),
})
  .annotate({
    description:
      "Check runs, such as GitHub Actions jobs. Polled for default-branch commits; webhooks cover all branches.",
  })
  .pipe(Iceberg.identifier("id"));

export type CheckRun = Schema.Schema.Type<typeof CheckRunSchema>;

export const CheckRunObjectSchema = CheckRunSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "repository_id"]),
);

export type CheckRunObject = Schema.Schema.Type<typeof CheckRunObjectSchema>;
