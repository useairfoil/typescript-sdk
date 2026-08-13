import { Schema } from "effect";

import {
  ResourceErrorSchema as StateResourceErrorSchema,
  ResourceStateSchema,
} from "../state-store/schema";

export const SyncStateSchema = Schema.Literals(["pending", "backfilling", "live", "error"]);
export type SyncState = Schema.Schema.Type<typeof SyncStateSchema>;

/** Safe source failure returned by the status endpoint. */
export const ResourceErrorSchema = StateResourceErrorSchema;
export type ResourceError = Schema.Schema.Type<typeof ResourceErrorSchema>;

export const ResourceStatusSchema = Schema.Struct({
  name: Schema.String,
  state: SyncStateSchema,
  ...ResourceStateSchema.fields,
});
export type ResourceStatus = Schema.Schema.Type<typeof ResourceStatusSchema>;

export const StatusResponseSchema = Schema.Struct({
  connector: Schema.String,
  resources: Schema.Array(ResourceStatusSchema),
});
export type StatusResponse = Schema.Schema.Type<typeof StatusResponseSchema>;

/** Returned when durable resource status cannot be read. */
export const StatusUnavailableResponseSchema = Schema.Struct({
  ok: Schema.Literal(false),
  error: Schema.String,
});
export type StatusUnavailableResponse = Schema.Schema.Type<typeof StatusUnavailableResponseSchema>;
