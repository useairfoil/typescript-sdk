import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, SchemaTransformation, Struct } from "effect";

import {
  Long,
  OptionalRef,
  OptionalString,
  OptionalTimestamp,
  Ref,
  common,
  field,
  list,
} from "./shared";

export const ReleaseSchema = Schema.Struct({
  ...common("Release"),
  name: Schema.String.pipe(field(10, "Release name.")),
  description: OptionalString.pipe(field(11, "Description.")),
  // `version` is the row version, so the release's own version is renamed.
  release_version: OptionalString.pipe(field(12, "Version, such as 1.2.0.")),
  url: Schema.String.pipe(field(13, "Release URL.")),
  commit_sha: OptionalString.pipe(field(14, "Commit SHA.")),
  pipeline_id: Ref.pipe(field(15, "Release pipeline.")),
  stage_id: Ref.pipe(field(16, "Release stage.")),
  creator_id: OptionalRef.pipe(field(17, "User who made the release.")),
  start_date: OptionalString.pipe(field(18, "Start date, as YYYY-MM-DD.")),
  target_date: OptionalString.pipe(field(19, "Target date, as YYYY-MM-DD.")),
  started_at: OptionalTimestamp.pipe(field(20, "Time the release started.")),
  completed_at: OptionalTimestamp.pipe(field(21, "Time the release was completed.")),
  canceled_at: OptionalTimestamp.pipe(field(22, "Time the release was canceled.")),
  trashed: Schema.NullOr(Schema.Boolean).pipe(field(23, "Whether the release is in the trash.")),
})
  .annotate({ description: "Linear releases. Needs the Business plan." })
  .pipe(Iceberg.identifier("id"));

export type Release = Schema.Schema.Type<typeof ReleaseSchema>;

export const ReleaseObjectSchema = ReleaseSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const ReleaseNoteSchema = Schema.Struct({
  ...common("Release note"),
  title: OptionalString.pipe(field(10, "Release note title.")),
  content: Schema.NullOr(Schema.Struct({ content: OptionalString })).pipe(
    Schema.decodeTo(
      OptionalString,
      SchemaTransformation.transform({
        decode: (document) => document?.content ?? null,
        encode: (content) => (content === null ? null : { content }),
      }),
    ),
    field(11, "Release note body in markdown."),
  ),
  url: Schema.String.pipe(field(12, "Release note URL.")),
  pipeline_id: Ref.pipe(field(13, "Release pipeline.")),
  release_ids: list(101, Ref).pipe(field(14, "Releases covered by the note.")),
})
  .annotate({ description: "Linear release notes. Needs the Business plan." })
  .pipe(Iceberg.identifier("id"));

export type ReleaseNote = Schema.Schema.Type<typeof ReleaseNoteSchema>;

export const ReleaseNoteObjectSchema = ReleaseNoteSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const ReleasePipelineSchema = Schema.Struct({
  ...common("Pipeline"),
  name: Schema.String.pipe(field(10, "Pipeline name.")),
  type: Schema.String.pipe(field(11, "Pipeline type.")),
  is_production: Schema.Boolean.pipe(field(12, "Whether it releases to production.")),
  url: Schema.String.pipe(field(13, "Pipeline URL.")),
  include_path_patterns: list(101, Schema.String).pipe(
    field(14, "File paths that count toward the pipeline."),
  ),
  approximate_release_count: Long.pipe(field(15, "About how many releases it has.")),
  trashed: Schema.NullOr(Schema.Boolean).pipe(field(16, "Whether the pipeline is in the trash.")),
})
  .annotate({ description: "Linear release pipelines. Needs the Business plan." })
  .pipe(Iceberg.identifier("id"));

export type ReleasePipeline = Schema.Schema.Type<typeof ReleasePipelineSchema>;

export const ReleasePipelineObjectSchema = ReleasePipelineSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const ReleaseStageSchema = Schema.Struct({
  ...common("Stage"),
  name: Schema.String.pipe(field(10, "Stage name.")),
  type: Schema.String.pipe(field(11, "Stage type.")),
  color: Schema.String.pipe(field(12, "Color, as hex.")),
  position: Schema.Finite.pipe(field(13, "Order in the pipeline.")),
  frozen: Schema.Boolean.pipe(field(14, "Whether the stage is frozen.")),
  pipeline_id: Ref.pipe(field(15, "Release pipeline.")),
})
  .annotate({ description: "Linear release stages. Needs the Business plan." })
  .pipe(Iceberg.identifier("id"));

export type ReleaseStage = Schema.Schema.Type<typeof ReleaseStageSchema>;

export const ReleaseStageObjectSchema = ReleaseStageSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const IssueToReleaseSchema = Schema.Struct({
  ...common("Link"),
  issue_id: Ref.pipe(field(10, "Issue.")),
  release_id: Ref.pipe(field(11, "Release.")),
})
  .annotate({ description: "Links between Linear issues and releases. Needs the Business plan." })
  .pipe(Iceberg.identifier("id"));

export type IssueToRelease = Schema.Schema.Type<typeof IssueToReleaseSchema>;

export const IssueToReleaseObjectSchema = IssueToReleaseSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);
