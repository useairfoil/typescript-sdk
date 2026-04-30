import { Context, Layer } from "effect";

import type { ConnectorDefinition } from "../core/types";

export type ConnectorRuntimeContextValue = {
  readonly connector: ConnectorDefinition;
};

export class ConnectorRuntimeContext extends Context.Service<
  ConnectorRuntimeContext,
  ConnectorRuntimeContextValue
>()("@useairfoil/connector-kit/ConnectorRuntimeContext") {}

export const layer = (connector: ConnectorDefinition) =>
  Layer.succeed(ConnectorRuntimeContext)(ConnectorRuntimeContext.of({ connector }));
