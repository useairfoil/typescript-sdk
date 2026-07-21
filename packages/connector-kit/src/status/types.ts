import { Schema } from "effect";

import { ResourceStateSchema } from "../state-store/schema";

export const SyncStateSchema = Schema.Literals(["pending", "backfilling", "live", "error"]);

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
