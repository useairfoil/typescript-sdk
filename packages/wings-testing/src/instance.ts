import { Effect, Layer, Scope, Context } from "effect";
import { GenericContainer, Wait } from "testcontainers";

export class Instance extends Context.Service<
  Instance,
  {
    readonly grpcHostAndPort: Effect.Effect<string>;
    readonly httpHostAndPort: Effect.Effect<string>;
  }
>()("@useairfoil/wings-testing/Instance") {}

/// A layer that uses an external Wings instance.
export const external = (args: { host?: string; grpcPort?: number; httpPort?: number } = {}) => {
  const host = args.host ?? "localhost";
  const grpcPort = args.grpcPort ?? 7777;
  const httpPort = args.httpPort ?? 7780;

  return Layer.succeed(Instance, {
    grpcHostAndPort: Effect.succeed(`${host}:${grpcPort}`),
    httpHostAndPort: Effect.succeed(`${host}:${httpPort}`),
  });
};

/// A layer that runs a Wings container for testing.
export const container = Layer.effect(Instance)(
  Effect.gen(function* () {
    const scope = yield* Scope.Scope;

    const container = yield* Effect.tryPromise({
      try: () =>
        new GenericContainer("docker.useairfoil.com/airfoil/wings:0.1.0")
          .withCommand(["dev", "--http.address=0.0.0.0:7780", "--metadata.address=0.0.0.0:7777"])
          .withExposedPorts(7777, 7780)
          .withTmpFs({ "/tmp": "rw" })
          .withWaitStrategy(Wait.forLogMessage(/gRPC server listening on 0\.0\.0\.0:7777/))
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
        Effect.catch((error) => Effect.log(`Error stopping container: ${error}`)),
      ),
    );

    return {
      grpcHostAndPort: Effect.gen(function* () {
        const port = yield* Effect.sync(() => container.getMappedPort(7777));
        const host = yield* Effect.sync(() => container.getHost());
        return `${host}:${port}`;
      }),
      httpHostAndPort: Effect.gen(function* () {
        const port = yield* Effect.sync(() => container.getMappedPort(7780));
        const host = yield* Effect.sync(() => container.getHost());
        return `${host}:${port}`;
      }),
    };
  }),
);
