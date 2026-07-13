import { Cause, Context, DateTime, Effect, Layer, Option, Schema } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";

import type { Cursor, ResourceDefinition, ResourceState, SyncState } from "../core/types";

import { ConnectorError } from "../errors";

const CursorValueSchema = Schema.Union([Schema.String, Schema.Number]);

/** Normalizes a cursor value to its persisted/wire representation (never a `Date`). */
export const normalizeCursor = (value: Cursor.Value): string | number =>
  value instanceof Date ? value.toISOString() : value;

export const ResourceStateSchema = Schema.Struct({
  backfill: Schema.optional(
    Schema.Struct({
      cutoff: CursorValueSchema,
      pageCursor: Schema.optional(CursorValueSchema),
      completed: Schema.Boolean,
    }),
  ),
  changes: Schema.optional(
    Schema.Struct({
      cursor: CursorValueSchema,
    }),
  ),
  lastError: Schema.optional(
    Schema.Struct({
      message: Schema.String,
      at: Schema.String,
    }),
  ),
});

/**
 * The shape actually persisted by the state store: cursors are always
 * normalized to `string | number` (never `Date`) by the time they're written -
 * see `ingestion/engine.ts`'s `normalizeResourceState`.
 */
export type PersistedResourceState = Schema.Schema.Type<typeof ResourceStateSchema>;

export interface StateStoreService {
  readonly getResourceState: (
    resource: string,
  ) => Effect.Effect<PersistedResourceState | undefined, ConnectorError>;
  readonly setResourceState: (
    resource: string,
    state: PersistedResourceState,
  ) => Effect.Effect<void, ConnectorError>;
  readonly setResourceError: (
    resource: string,
    error: Cause.Cause<ConnectorError>,
  ) => Effect.Effect<void, ConnectorError>;
}

export class StateStore extends Context.Service<StateStore, StateStoreService>()(
  "@useairfoil/connector-kit/StateStore",
) {}

const resourceKey = (resource: string) => `resource-state:${resource}`;

/** Typed resource-state API, built on top of Effect's `KeyValueStore`. */
export const layer: Layer.Layer<StateStore, never, KeyValueStore.KeyValueStore> = Layer.effect(
  StateStore,
)(
  Effect.gen(function* () {
    const kv = yield* KeyValueStore.KeyValueStore;
    const store = KeyValueStore.toSchemaStore(kv, ResourceStateSchema);

    const getResourceState = (resource: string) =>
      store.get(resourceKey(resource)).pipe(
        Effect.map(Option.getOrUndefined),
        Effect.mapError(
          (cause) =>
            new ConnectorError({ message: `Failed to read state for resource ${resource}`, cause }),
        ),
      );

    const setResourceState = (resource: string, state: PersistedResourceState) =>
      store.set(resourceKey(resource), state).pipe(
        Effect.mapError(
          (cause) =>
            new ConnectorError({
              message: `Failed to write state for resource ${resource}`,
              cause,
            }),
        ),
      );

    // Read-modify-write, not compare-and-swap: can race with a concurrent `setResourceState`.
    // in practice - the sibling backfill/changes fiber is normally interrupted before this runs
    const setResourceError = (resource: string, error: Cause.Cause<ConnectorError>) =>
      Effect.gen(function* () {
        const existing = yield* getResourceState(resource);
        const at = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
        yield* setResourceState(resource, {
          ...existing,
          lastError: { message: Cause.pretty(error), at },
        });
      });

    return StateStore.of({ getResourceState, setResourceState, setResourceError });
  }),
);

/**
 * Derives the connector-facing sync state purely from state-store data + resource
 * capabilities. Only inspects `completed`/`lastError` (never the cursor values), so it
 * accepts both a persisted state and the wider in-flight `ResourceState` engine.ts
 * builds before a resource's first write.
 */
export const deriveSyncState = (
  resource: ResourceDefinition,
  state: ResourceState | undefined,
): SyncState => {
  if (state?.lastError) return "error";
  // Webhook-only resources have no backfill/changes progress to track, so nothing
  // ever writes state for them - they're live from the moment the connector starts.
  if (!resource.backfill && !resource.changes) return "live";
  if (!state) return "pending";
  if (resource.backfill && (!state.backfill || !state.backfill.completed)) return "backfilling";
  return "live";
};
