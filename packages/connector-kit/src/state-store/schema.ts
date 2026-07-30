import { Schema } from "effect";

const CursorValueSchema = Schema.Union([Schema.String, Schema.Number]);

/** Durable progress for a finite historical backfill. */
export const BackfillStateSchema = Schema.Struct({
  cutoff: CursorValueSchema,
  pageCursor: Schema.optional(CursorValueSchema),
  completed: Schema.Boolean,
  lastSuccessAt: Schema.optional(Schema.String),
});

/** Durable cursor for an ongoing incremental changes stream. */
export const ChangesStateSchema = Schema.Struct({
  cursor: CursorValueSchema,
  lastSuccessAt: Schema.optional(Schema.String),
});

export const StateSourceSchema = Schema.Literals(["backfill", "changes"]);

export const StateOperationSchema = Schema.Literals(["fetch", "publish", "checkpoint"]);

export const StateErrorCodeSchema = Schema.Literals([
  "fetch_failed",
  "publish_failed",
  "checkpoint_failed",
]);

/** SDK-owned error context safe to persist and expose through status. */
export const ResourceErrorContextSchema = Schema.Struct({
  source: StateSourceSchema,
  operation: StateOperationSchema,
  code: StateErrorCodeSchema,
  message: Schema.String,
});

/** Stable public error summary persisted for status reporting; never a raw cause. */
export const ResourceErrorSchema = Schema.Struct({
  ...ResourceErrorContextSchema.fields,
  at: Schema.String,
});

/** Complete persisted state assembled from independently stored components. */
export const ResourceStateSchema = Schema.Struct({
  backfill: Schema.optional(BackfillStateSchema),
  changes: Schema.optional(ChangesStateSchema),
  lastError: Schema.optional(ResourceErrorSchema),
});

export type PersistedBackfillState = Schema.Schema.Type<typeof BackfillStateSchema>;
export type PersistedChangesState = Schema.Schema.Type<typeof ChangesStateSchema>;
export type StateSource = Schema.Schema.Type<typeof StateSourceSchema>;
export type StateOperation = Schema.Schema.Type<typeof StateOperationSchema>;
export type StateErrorCode = Schema.Schema.Type<typeof StateErrorCodeSchema>;
export type ResourceErrorContext = Schema.Schema.Type<typeof ResourceErrorContextSchema>;
export type PersistedResourceError = Schema.Schema.Type<typeof ResourceErrorSchema>;
export type PersistedResourceState = Schema.Schema.Type<typeof ResourceStateSchema>;
