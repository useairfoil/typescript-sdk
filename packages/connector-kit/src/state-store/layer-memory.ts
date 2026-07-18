import { Layer } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";

import type { StateStore } from "./service";

import { layerKeyValueStore } from "./layer-key-value-store";

/** Process-local state for tests and explicit local sandbox commands. */
export const layerMemory: Layer.Layer<StateStore> = layerKeyValueStore.pipe(
  Layer.provide(KeyValueStore.layerMemory),
);
