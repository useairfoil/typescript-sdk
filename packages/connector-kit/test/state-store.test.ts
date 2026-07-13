import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";

import { layer as StateStoreLayer, StateStore } from "../src/state-store";

// A `KeyValueStore` whose every operation fails, so we can assert `StateStore` wraps
// the resulting `KeyValueStoreError` into a `ConnectorError` with useful context.
const layerFailingKeyValue = Layer.succeed(KeyValueStore.KeyValueStore)(
  KeyValueStore.make({
    get: () =>
      Effect.fail(new KeyValueStore.KeyValueStoreError({ method: "get", message: "boom" })),
    getUint8Array: () =>
      Effect.fail(
        new KeyValueStore.KeyValueStoreError({ method: "getUint8Array", message: "boom" }),
      ),
    set: () =>
      Effect.fail(new KeyValueStore.KeyValueStoreError({ method: "set", message: "boom" })),
    remove: () =>
      Effect.fail(new KeyValueStore.KeyValueStoreError({ method: "remove", message: "boom" })),
    clear: Effect.fail(new KeyValueStore.KeyValueStoreError({ method: "clear", message: "boom" })),
    size: Effect.fail(new KeyValueStore.KeyValueStoreError({ method: "size", message: "boom" })),
  }),
);

describe("state store error handling", () => {
  it.effect("wraps a failing KeyValueStore.get into a ConnectorError with resource context", () =>
    Effect.gen(function* () {
      const error = yield* StateStore.pipe(
        Effect.flatMap((store) => store.getResourceState("products")),
        Effect.flip,
      );

      expect(error.message).toContain("Failed to read state for resource products");
      expect(error.cause).toBeInstanceOf(KeyValueStore.KeyValueStoreError);
    }).pipe(Effect.provide(StateStoreLayer.pipe(Layer.provide(layerFailingKeyValue)))),
  );

  it.effect("wraps a failing KeyValueStore.set into a ConnectorError with resource context", () =>
    Effect.gen(function* () {
      const error = yield* StateStore.pipe(
        Effect.flatMap((store) =>
          store.setResourceState("products", { backfill: { cutoff: "x", completed: true } }),
        ),
        Effect.flip,
      );

      expect(error.message).toContain("Failed to write state for resource products");
      expect(error.cause).toBeInstanceOf(KeyValueStore.KeyValueStoreError);
    }).pipe(Effect.provide(StateStoreLayer.pipe(Layer.provide(layerFailingKeyValue)))),
  );
});
