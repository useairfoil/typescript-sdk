import { Context, type Effect } from "effect";

import type { Cursor, IngestionState } from "../core/types";
import type { ConnectorError } from "../errors";

export interface StateStoreService {
  readonly getState: (
    key: string,
  ) => Effect.Effect<IngestionState<Cursor> | undefined, ConnectorError>;
  readonly setState: (
    key: string,
    state: IngestionState<Cursor>,
  ) => Effect.Effect<void, ConnectorError>;
}

export class StateStore extends Context.Service<StateStore, StateStoreService>()(
  "@useairfoil/connector-kit/StateStore",
) {}
