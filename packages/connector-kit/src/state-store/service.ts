import { Context, Effect } from "effect";

import type {
  PersistedBackfillState,
  PersistedChangesState,
  PersistedResourceState,
  StateOperation,
  StateSource,
} from "./schema";

import { ConnectorError } from "../errors";

/** Connector-facing durable state operations, independent of the storage backend. */
export interface StateStoreService {
  readonly getResourceState: (
    resource: string,
  ) => Effect.Effect<PersistedResourceState | undefined, ConnectorError>;
  readonly setBackfillState: (
    resource: string,
    state: PersistedBackfillState,
  ) => Effect.Effect<void, ConnectorError>;
  readonly setChangesState: (
    resource: string,
    state: PersistedChangesState,
  ) => Effect.Effect<void, ConnectorError>;
  readonly setResourceError: (
    resource: string,
    source: StateSource,
    operation: StateOperation,
  ) => Effect.Effect<void, ConnectorError>;
  readonly clearResourceError: (
    resource: string,
    source: StateSource,
  ) => Effect.Effect<void, ConnectorError>;
}

/**
 * Effect service used by ingestion and status logic for connector checkpoints.
 * Production provides `layerSql`; sandboxes and tests may provide `layerMemory`.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function* () {
 *   const state = yield* StateStore;
 *   yield* state.setChangesState("orders", { cursor: "next-page" });
 * });
 * ```
 */
export class StateStore extends Context.Service<StateStore, StateStoreService>()(
  "@useairfoil/connector-kit/StateStore",
) {}
