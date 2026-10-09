import { Schema, SchemaTransformation } from "effect";

import { Long, field, list, stringMap, version } from "./shared";

const StageSchema = Schema.Struct({
  id: Schema.String.pipe(field(102, "Stage ID, as used in `dealstage` or `hs_pipeline_stage`.")),
  label: Schema.String.pipe(field(103, "Stage name.")),
  display_order: Long.pipe(field(104, "Position of the stage in the pipeline.")),
  archived: Schema.Boolean.pipe(field(105, "Whether the stage was removed.")),
  metadata: stringMap(107, 108).pipe(
    field(106, "Stage settings, such as `probability` for deals or `ticketState` for tickets."),
  ),
});

export const PipelineSchema = Schema.Struct({
  key: Schema.String.pipe(field(1, "Object type and pipeline ID, such as `deals:default`.")),
  version: version(2),
  object_type: Schema.String.pipe(field(3, "deals or tickets.")),
  id: Schema.String.pipe(field(4, "Pipeline ID, as used in `pipeline` or `hs_pipeline`.")),
  label: Schema.String.pipe(field(5, "Pipeline name.")),
  display_order: Long.pipe(field(6, "Position of the pipeline.")),
  archived: Schema.Boolean.pipe(field(7, "Whether the pipeline was removed.")),
  stages: list(101, StageSchema).pipe(field(8, "Stages of the pipeline.")),
  created_at: Schema.Date.pipe(field(9, "Time the pipeline was created.")),
}).annotate({ description: "Deal and ticket pipelines with their stages." });

export type Pipeline = Schema.Schema.Type<typeof PipelineSchema>;

/** A pipeline as the API returns it. */
export const PipelineObjectSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  displayOrder: Long,
  archived: Schema.Boolean,
  createdAt: Schema.DateFromString,
  stages: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      label: Schema.String,
      displayOrder: Long,
      archived: Schema.Boolean,
      metadata: Schema.Record(Schema.String, Schema.String).pipe(
        Schema.decodeTo(
          stringMap(107, 108),
          SchemaTransformation.transform({
            decode: (record): ReadonlyMap<string, string> => new Map(Object.entries(record)),
            encode: (map) => Object.fromEntries(map),
          }),
        ),
      ),
    }),
  ),
});

export type PipelineObject = Schema.Schema.Type<typeof PipelineObjectSchema>;
