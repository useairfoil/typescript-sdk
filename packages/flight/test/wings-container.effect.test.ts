import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  EffectWingsContainer,
  EffectWingsContainerLive,
} from "./wings-container.effect";

describe("EffectWingsContainer", () => {
  it.effect(
    "should start Wings container successfully",
    () =>
      Effect.gen(function* () {
        const container = yield* EffectWingsContainer;
        const startedContainer = yield* container.getContainer;

        expect(startedContainer).toBeDefined();

        const containerId = startedContainer.getId();
        expect(containerId).toBeTruthy();
        expect(containerId.length).toBeGreaterThan(0);
      }).pipe(Effect.provide(EffectWingsContainerLive), Effect.scoped),
    { timeout: 60_000 },
  );

  it.effect(
    "should expose gRPC port with dynamic mapping",
    () =>
      Effect.gen(function* () {
        const container = yield* EffectWingsContainer;
        const grpcPort = yield* container.getGrpcPort;

        expect(grpcPort).toBeGreaterThan(0);
        expect(grpcPort).toBeLessThan(65536);

        const grpcHost = yield* container.getGrpcHost;
        expect(grpcHost).toMatch(/localhost:\d+/);
      }).pipe(Effect.provide(EffectWingsContainerLive), Effect.scoped),
    { timeout: 60_000 },
  );

  it.effect(
    "should expose HTTP port with dynamic mapping",
    () =>
      Effect.gen(function* () {
        const container = yield* EffectWingsContainer;
        const httpPort = yield* container.getHttpPort;

        expect(httpPort).toBeGreaterThan(0);
        expect(httpPort).toBeLessThan(65536);

        const httpHost = yield* container.getHttpHost;
        expect(httpHost).toMatch(/localhost:\d+/);
      }).pipe(Effect.provide(EffectWingsContainerLive), Effect.scoped),
    { timeout: 60_000 },
  );

  it.effect(
    "should be healthy and accessible",
    () =>
      Effect.gen(function* () {
        const container = yield* EffectWingsContainer;
        const startedContainer = yield* container.getContainer;
        const id = startedContainer.getId();

        expect(id).toBeTruthy();
        expect(id.length).toBeGreaterThan(0);

        const grpcHost = yield* container.getGrpcHost;
        const httpHost = yield* container.getHttpHost;

        expect(grpcHost).toBeTruthy();
        expect(httpHost).toBeTruthy();
      }).pipe(Effect.provide(EffectWingsContainerLive), Effect.scoped),
    { timeout: 60_000 },
  );
});
