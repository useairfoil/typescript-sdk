import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, field, list, user, version } from "./shared";

export const WorkflowRunSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique workflow run ID.")),
  version: version(2, "workflow run"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the run.")),
  repository_id: Long.pipe(field(4, "ID of the repository the run belongs to.")),
  workflow_id: Long.pipe(field(5, "ID of the workflow.")),
  name: Schema.NullOr(Schema.String).pipe(field(6, "Workflow name.")),
  display_title: Schema.String.pipe(field(7, "Title of the run, such as the commit message.")),
  path: Schema.String.pipe(field(8, "Path of the workflow file.")),
  event: Schema.String.pipe(field(9, "Event that started the run, such as push.")),
  status: Schema.NullOr(Schema.String).pipe(
    field(10, "Status, such as queued, in_progress, or completed."),
  ),
  conclusion: Schema.NullOr(Schema.String).pipe(
    field(11, "Result of a completed run, such as success or failure."),
  ),
  head_branch: Schema.NullOr(Schema.String).pipe(field(12, "Branch the run is for.")),
  head_sha: Schema.String.pipe(field(13, "SHA of the commit the run is for.")),
  run_number: Long.pipe(field(14, "Run number of the workflow.")),
  run_attempt: Schema.optionalKey(Long).pipe(field(15, "Attempt number. Re-runs count up.")),
  check_suite_id: Schema.optionalKey(Long).pipe(field(16, "ID of the run's check suite.")),
  actor: Schema.optionalKey(user(100)).pipe(field(17, "Account that started the first attempt.")),
  triggering_actor: Schema.optionalKey(user(103)).pipe(
    field(18, "Account that started the latest attempt."),
  ),
  pull_requests: list(
    106,
    Schema.Struct({
      id: Long.pipe(field(107, "Pull request ID.")),
      number: Long.pipe(field(108, "Pull request number.")),
    }),
  ).pipe(field(19, "Pull requests the run is for. Empty for forks.")),
  created_at: Timestamp.pipe(field(20, "Time the run was created.")),
  run_started_at: Schema.optionalKey(Timestamp).pipe(field(21, "Time the latest attempt started.")),
  html_url: Schema.String.pipe(field(22, "Run page on GitHub.")),
})
  .annotate({
    description: "GitHub Actions workflow runs in the installation's repositories.",
  })
  .pipe(Iceberg.identifier("id"));

export type WorkflowRun = Schema.Schema.Type<typeof WorkflowRunSchema>;

export const WorkflowRunObjectSchema = WorkflowRunSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "repository_id", "pull_requests"]),
  updated_at: Timestamp,
  pull_requests: Schema.NullOr(fields.pull_requests),
}));

export type WorkflowRunObject = Schema.Schema.Type<typeof WorkflowRunObjectSchema>;
