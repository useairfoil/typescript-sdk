import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, field, list, readVersion } from "./shared";

const step = Schema.Struct({
  number: Long.pipe(field(102, "Step number.")),
  name: Schema.String.pipe(field(103, "Step name.")),
  status: Schema.String.pipe(field(104, "Status, such as queued, in_progress, or completed.")),
  conclusion: Schema.NullOr(Schema.String).pipe(field(105, "Result of a completed step.")),
  started_at: Schema.optionalKey(Schema.NullOr(Timestamp)).pipe(
    field(106, "Time the step started."),
  ),
  completed_at: Schema.optionalKey(Schema.NullOr(Timestamp)).pipe(
    field(107, "Time the step completed."),
  ),
});

export const WorkflowJobSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique job ID.")),
  version: readVersion(2, "job"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the job.")),
  repository_id: Long.pipe(field(4, "ID of the repository the job belongs to.")),
  run_id: Long.pipe(field(5, "ID of the workflow run.")),
  run_attempt: Schema.optionalKey(Long).pipe(field(6, "Attempt of the run the job belongs to.")),
  workflow_name: Schema.NullOr(Schema.String).pipe(field(7, "Workflow name.")),
  name: Schema.String.pipe(field(8, "Job name.")),
  head_sha: Schema.String.pipe(field(9, "SHA of the commit the job ran on.")),
  head_branch: Schema.NullOr(Schema.String).pipe(field(10, "Branch the job ran on.")),
  status: Schema.String.pipe(field(11, "Status, such as queued, in_progress, or completed.")),
  conclusion: Schema.NullOr(Schema.String).pipe(
    field(12, "Result of a completed job, such as success or failure."),
  ),
  created_at: Timestamp.pipe(field(13, "Time the job was queued.")),
  started_at: Timestamp.pipe(field(14, "Time the job started.")),
  completed_at: Schema.NullOr(Timestamp).pipe(field(15, "Time the job completed.")),
  runner_name: Schema.NullOr(Schema.String).pipe(field(16, "Name of the runner.")),
  labels: list(100, Schema.String).pipe(field(17, "Runner labels the job asked for.")),
  steps: list(101, step).pipe(field(18, "Steps of the job.")),
  html_url: Schema.NullOr(Schema.String).pipe(field(19, "Job page on GitHub.")),
})
  .annotate({
    description: "Jobs of GitHub Actions workflow runs. Each run attempt has its own jobs.",
  })
  .pipe(Iceberg.identifier("id"));

export type WorkflowJob = Schema.Schema.Type<typeof WorkflowJobSchema>;

export const WorkflowJobObjectSchema = WorkflowJobSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "repository_id", "steps"]),
  steps: Schema.optionalKey(Schema.Array(step)),
}));

export type WorkflowJobObject = Schema.Schema.Type<typeof WorkflowJobObjectSchema>;
