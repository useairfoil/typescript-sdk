import { Effect, Layer, Ref } from "effect";
import * as ServiceMap from "effect/ServiceMap";
import type { ConnectorError } from "../core/errors";
import type { Cursor, IngestionState } from "../core/types";

export class StateStore extends ServiceMap.Service<
  StateStore,
  {
    readonly getState: (
      key: string,
    ) => Effect.Effect<IngestionState<Cursor> | undefined, ConnectorError>;
    readonly setState: (
      key: string,
      state: IngestionState<Cursor>,
    ) => Effect.Effect<void, ConnectorError>;
  }
>()("StateStore") {}

export const StateStoreInMemory = Layer.effect(StateStore)(
  Effect.gen(function* () {
    const ref = yield* Ref.make(new Map<string, IngestionState<Cursor>>());

    return {
      getState: (key) => Effect.map(Ref.get(ref), (map) => map.get(key)),
      setState: (key, state) =>
        Effect.map(
          Ref.update(ref, (map) => {
            const next = new Map(map);
            next.set(key, state);
            return next;
          }),
          () => undefined,
        ),
    };
  }),
);
