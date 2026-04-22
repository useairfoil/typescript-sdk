import { Layer } from "effect";
import * as ServiceMap from "effect/ServiceMap";
import type { ConnectorDefinition } from "../core/types";

export type ConnectorRuntimeContextValue = {
  readonly connector: ConnectorDefinition;
};

export class ConnectorRuntimeContext extends ServiceMap.Service<
  ConnectorRuntimeContext,
  ConnectorRuntimeContextValue
>()("@useairfoil/connector-kit/ConnectorRuntimeContext") {}

export const ConnectorRuntimeContextLayer = (connector: ConnectorDefinition) =>
  Layer.succeed(ConnectorRuntimeContext)({ connector });
