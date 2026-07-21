import type { Cursor, ResourceDefinition, ResourceState, SyncState } from "../core/types";

/** Normalizes a cursor value to its persisted/wire representation (never a Date). */
export const normalizeCursor = (value: Cursor.Value): string | number =>
  value instanceof Date ? value.toISOString() : value;

/** Derives connector-facing sync state from durable state and resource capabilities. */
export const deriveSyncState = (
  resource: ResourceDefinition,
  state: ResourceState | undefined,
): SyncState => {
  if (state?.lastError) return "error";
  if (!resource.backfill && !resource.changes) return "live";
  if (!state) return "pending";
  if (resource.backfill && (!state.backfill || !state.backfill.completed)) return "backfilling";
  return "live";
};
