import type {
  ConnectorDefinition,
  EntityDefinition,
  EventDefinition,
} from "./types";

export const defineConnector = <Config>(
  definition: ConnectorDefinition<Config>,
) => definition;

export const defineEntity = <T extends Record<string, unknown>>(
  definition: EntityDefinition<T>,
) => definition;

export const defineEvent = <T extends Record<string, unknown>>(
  definition: EventDefinition<T>,
) => definition;
