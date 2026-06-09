import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { TestWings } from "../src";

describe("WingsContainer", () => {
  it.effect(
    "should start Wings container successfully",
    () =>
      Effect.gen(function* () {
        const container = yield* TestWings.Instance;
        const grpcHost = yield* container.grpcHostAndPort;

        expect(grpcHost).toBeTruthy();
        expect(grpcHost).toMatch(/^\S+:\d+$/);
      }).pipe(Effect.provide(Layer.mergeAll(TestWings.container)), Effect.scoped),
    { timeout: 120_000 },
  );
});
