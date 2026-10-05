import type {
  ConnectorDefinition,
  Cursor,
  ResourceDefinition,
  ResourceState,
  SyncState,
} from "../core/types";

/** Normalizes a cursor value to its persisted/wire representation (never a Date). */
export const normalizeCursor = (value: Cursor.Value): string | number =>
  value instanceof Date ? value.toISOString() : value;

/** Whether a resource gets changes, from its own `changes` or the connector's feed. */
export const hasChanges = (connector: ConnectorDefinition, resource: ResourceDefinition) =>
  resource.changes !== undefined ||
  (connector.changes?.resources.some((member) => member.name === resource.name) ?? false);

/** Derives connector-facing sync state from durable state and resource capabilities. */
export const deriveSyncState = (
  connector: ConnectorDefinition,
  resource: ResourceDefinition,
  state: ResourceState | undefined,
): SyncState => {
  if (state?.lastError) return "error";
  if (!resource.backfill && !hasChanges(connector, resource)) return "live";
  if (!state) return "pending";
  if (resource.backfill && (!state.backfill || !state.backfill.completed)) return "backfilling";
  return "live";
};
