import { Context, Effect, Layer, Scope } from "effect";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";

export class EffectWingsContainer extends Context.Tag("EffectWingsContainer")<
  EffectWingsContainer,
  {
    readonly getGrpcPort: Effect.Effect<number>;
    readonly getHttpPort: Effect.Effect<number>;
    readonly getGrpcHost: Effect.Effect<string>;
    readonly getHttpHost: Effect.Effect<string>;
    readonly getContainer: Effect.Effect<StartedTestContainer>;
  }
>() {}

export const EffectWingsContainerLive = Layer.scoped(
  EffectWingsContainer,
  Effect.gen(function* () {
    const scope = yield* Scope.Scope;

    const container = yield* Effect.tryPromise({
      try: () =>
        new GenericContainer("docker.useairfoil.com/airfoil/wings:latest")
          .withCommand([
            "dev",
            "--http-address=0.0.0.0:7780",
            "--metadata-address=0.0.0.0:7777",
          ])
          .withExposedPorts(7777, 7780)
          .withTmpFs({ "/tmp": "rw" })
          .withWaitStrategy(
            Wait.forLogMessage(/gRPC server listening on 0\.0\.0\.0:7777/),
          )
          .withStartupTimeout(60_000)
          .start(),
      catch: (error) => new Error(`Failed to start container: ${error}`),
    });

    yield* Scope.addFinalizer(
      scope,
      Effect.tryPromise({
        try: () => container.stop(),
        catch: (error) => new Error(`Failed to stop container: ${error}`),
      }).pipe(
        Effect.tap(() => Effect.log("Container stopped successfully")),
        Effect.catchAll((error) =>
          Effect.log(`Error stopping container: ${error}`),
        ),
      ),
    );

    return {
      getGrpcPort: Effect.sync(() => container.getMappedPort(7777)),
      getHttpPort: Effect.sync(() => container.getMappedPort(7780)),
      getGrpcHost: Effect.gen(function* () {
        const port = yield* Effect.sync(() => container.getMappedPort(7777));
        const host = yield* Effect.sync(() => container.getHost());
        return `${host}:${port}`;
      }),
      getHttpHost: Effect.gen(function* () {
        const port = yield* Effect.sync(() => container.getMappedPort(7780));
        const host = yield* Effect.sync(() => container.getHost());
        return `${host}:${port}`;
      }),
      getContainer: Effect.succeed(container),
    };
  }),
);
