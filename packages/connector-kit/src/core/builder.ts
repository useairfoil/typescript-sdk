import type {
  ConnectorDefinition,
  EntityDefinition,
  EntitySchema,
  EventDefinition,
} from "./types";

export const defineConnector = <
  Config,
  const Entities extends ReadonlyArray<EntityDefinition<EntitySchema>>,
  const Events extends ReadonlyArray<EventDefinition<EntitySchema>>,
>(
  definition: ConnectorDefinition<Config, Entities, Events>,
) => definition;

export const defineEntity = <S extends EntitySchema>(
  definition: EntityDefinition<S>,
) => definition;

export const defineEvent = <S extends EntitySchema>(
  definition: EventDefinition<S>,
) => definition;
