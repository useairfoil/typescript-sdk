import { Effect, Layer, Ref } from "effect";

import type { Cursor, IngestionState } from "../core/types";

import { StateStore } from "./service";

/** In-memory state store backed by a `Ref<Map>`. Suitable for development and testing. */
export const layerMemory: Layer.Layer<StateStore> = Layer.effect(StateStore)(
  Effect.gen(function* () {
    const ref = yield* Ref.make(new Map<string, IngestionState<Cursor>>());

    return StateStore.of({
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
    });
  }),
);
