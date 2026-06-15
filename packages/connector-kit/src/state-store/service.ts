import { Context, type Effect } from "effect";

import type { ResourceState } from "../core/types";
import type { ConnectorError } from "../errors";

export interface StateStoreService {
  readonly getResourceState: (
    resource: string,
  ) => Effect.Effect<ResourceState | undefined, ConnectorError>;
  readonly setResourceState: (
    resource: string,
    state: ResourceState,
  ) => Effect.Effect<void, ConnectorError>;
}

export class StateStore extends Context.Service<StateStore, StateStoreService>()(
  "@useairfoil/connector-kit/StateStore",
) {}
