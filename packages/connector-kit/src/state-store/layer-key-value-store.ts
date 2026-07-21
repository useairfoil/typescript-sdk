import { DateTime, Effect, Layer, Option, Schema } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";

import { ConnectorError } from "../errors";
import { resourceComponentKey, resourceErrorKey } from "./keys";
import {
  BackfillStateSchema,
  ChangesStateSchema,
  ResourceErrorSchema,
  type PersistedBackfillState,
  type PersistedChangesState,
  type PersistedResourceError,
  type ResourceErrorContext,
  type StateOperation,
  type StateSource,
} from "./schema";
import { StateStore } from "./service";

const mapStoreError = (operation: "read" | "write" | "clear", resource: string) =>
  Effect.mapError(
    (cause: KeyValueStore.KeyValueStoreError | Schema.SchemaError) =>
      new ConnectorError({
        message: `Failed to ${operation} state for resource ${resource}`,
        cause,
      }),
  );

const resourceErrorContext = (
  source: StateSource,
  operation: StateOperation,
): ResourceErrorContext => {
  const sourceName = source === "backfill" ? "Backfill" : "Changes";
  switch (operation) {
    case "fetch":
      return { source, operation, code: "fetch_failed", message: `${sourceName} fetch failed` };
    case "publish":
      return { source, operation, code: "publish_failed", message: `${sourceName} publish failed` };
    case "checkpoint":
      return {
        source,
        operation,
        code: "checkpoint_failed",
        message: `${sourceName} checkpoint failed`,
      };
  }
};

const latestError = (
  backfill: Option.Option<PersistedResourceError>,
  changes: Option.Option<PersistedResourceError>,
): Option.Option<PersistedResourceError> => {
  if (Option.isNone(backfill)) return changes;
  if (Option.isNone(changes)) return backfill;
  return backfill.value.at >= changes.value.at ? backfill : changes;
};

/**
 * Implements StateStore over any Effect KeyValueStore. `toSchemaStore` owns
 * serialization and validates persisted values when they are read and written.
 * The caller owns instance scoping; `layerSql` supplies the production prefix.
 */
export const layerKeyValueStore: Layer.Layer<StateStore, never, KeyValueStore.KeyValueStore> =
  Layer.effect(StateStore)(
    Effect.gen(function* () {
      const keyValueStore = yield* KeyValueStore.KeyValueStore;
      const backfillStore = KeyValueStore.toSchemaStore(keyValueStore, BackfillStateSchema);
      const changesStore = KeyValueStore.toSchemaStore(keyValueStore, ChangesStateSchema);
      const errorStore = KeyValueStore.toSchemaStore(keyValueStore, ResourceErrorSchema);

      const getResourceState = (resource: string) =>
        // Components use separate keys so a cursor update cannot overwrite the
        // independently managed error or backfill state.
        Effect.all(
          {
            backfill: backfillStore.get(resourceComponentKey(resource, "backfill")),
            changes: changesStore.get(resourceComponentKey(resource, "changes")),
            backfillError: errorStore.get(resourceErrorKey(resource, "backfill")),
            changesError: errorStore.get(resourceErrorKey(resource, "changes")),
          },
          { concurrency: "unbounded" },
        ).pipe(
          Effect.map(({ backfill, changes, backfillError, changesError }) => {
            const lastError = latestError(backfillError, changesError);
            if (Option.isNone(backfill) && Option.isNone(changes) && Option.isNone(lastError)) {
              return undefined;
            }
            return {
              ...(Option.isSome(backfill) ? { backfill: backfill.value } : {}),
              ...(Option.isSome(changes) ? { changes: changes.value } : {}),
              ...(Option.isSome(lastError) ? { lastError: lastError.value } : {}),
            };
          }),
          mapStoreError("read", resource),
        );

      const setBackfillState = (resource: string, state: PersistedBackfillState) =>
        backfillStore
          .set(resourceComponentKey(resource, "backfill"), state)
          .pipe(mapStoreError("write", resource));

      const setChangesState = (resource: string, state: PersistedChangesState) =>
        changesStore
          .set(resourceComponentKey(resource, "changes"), state)
          .pipe(mapStoreError("write", resource));

      const setResourceError = (resource: string, source: StateSource, operation: StateOperation) =>
        DateTime.now.pipe(
          Effect.map(DateTime.formatIso),
          Effect.flatMap((at) => {
            const error = resourceErrorContext(source, operation);
            return errorStore.set(resourceErrorKey(resource, source), {
              ...error,
              at,
            });
          }),
          mapStoreError("write", resource),
        );

      const clearResourceError = (resource: string, source: StateSource) =>
        errorStore
          .remove(resourceErrorKey(resource, source))
          .pipe(mapStoreError("clear", resource));

      return StateStore.of({
        getResourceState,
        setBackfillState,
        setChangesState,
        setResourceError,
        clearResourceError,
      });
    }),
  );
