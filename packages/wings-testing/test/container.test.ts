import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { TestWings } from "../src";

describe("WingsContainer", () => {
  it.effect(
    "should start Wings container successfully",
    () =>
      Effect.gen(function* () {
        const container = yield* TestWings.Instance;
        const uri = yield* container.uri;
        const icebergRestUri = yield* container.icebergRestUri;

        expect(uri).toMatch(/^http:\/\/\S+:\d+$/);
        expect(icebergRestUri).toMatch(/^http:\/\/\S+:8181$/);
      }).pipe(Effect.provide(Layer.mergeAll(TestWings.container)), Effect.scoped),
    { timeout: 120_000 },
  );
});
