import { Effect, Layer, Ref } from "effect";

import type { ResourceState } from "../core/types";

import { StateStore } from "./service";

/** In-memory resource state store backed by a `Ref<Map>`. Suitable for development and tests. */
export const layerMemory: Layer.Layer<StateStore> = Layer.effect(StateStore)(
  Effect.gen(function* () {
    const ref = yield* Ref.make(new Map<string, ResourceState>());

    return StateStore.of({
      getResourceState: (resource) => Effect.map(Ref.get(ref), (map) => map.get(resource)),
      setResourceState: (resource, state) =>
        Effect.map(
          Ref.update(ref, (map) => {
            const next = new Map(map);
            next.set(resource, state);
            return next;
          }),
          () => undefined,
        ),
    });
  }),
);
