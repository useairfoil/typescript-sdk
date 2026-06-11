import { Effect, Layer, Scope, Context } from "effect";
import { GenericContainer, Network, Wait } from "testcontainers";

export class Instance extends Context.Service<
  Instance,
  {
    readonly grpcHostAndPort: Effect.Effect<string>;
  }
>()("@useairfoil/wings-testing/Instance") {}

/// A layer that uses an external Wings instance.
export const external = (args: { host?: string; grpcPort?: number } = {}) => {
  const host = args.host ?? "localhost";
  const grpcPort = args.grpcPort ?? 7777;

  return Layer.succeed(Instance, {
    grpcHostAndPort: Effect.succeed(`${host}:${grpcPort}`),
  });
};

/// A layer that runs Wings + SeaweedFS containers for testing.
export const container = Layer.effect(Instance)(
  Effect.gen(function* () {
    const scope = yield* Scope.Scope;

    const network = yield* Effect.tryPromise({
      try: () => new Network().start(),
      catch: (error) => new Error(`Failed to create network: ${error}`),
    });

    yield* Scope.addFinalizer(
      scope,
      Effect.tryPromise({
        try: () => network.stop(),
        catch: (error) => new Error(`Failed to stop network: ${error}`),
      }).pipe(Effect.catchCause(() => Effect.void)),
    );

    const seaweedfs = yield* Effect.tryPromise({
      try: () =>
        new GenericContainer("chrislusf/seaweedfs:4.29")
          .withNetwork(network)
          .withNetworkAliases("seaweedfs")
          .withEntrypoint(["weed"])
          .withCommand(["mini", "-s3", "-dir=/data"])
          .withEnvironment({
            AWS_ACCESS_KEY_ID: "wingsdevaccesskey",
            AWS_SECRET_ACCESS_KEY: "wingsdevsecretkey",
            S3_BUCKET: "default-bucket",
          })
          .withTmpFs({ "/data": "rw" })
          .withWaitStrategy(Wait.forLogMessage(/S3\s+ready/))
          .withStartupTimeout(30_000)
          .start(),
      catch: (error) => new Error(`Failed to start SeaweedFS container: ${error}`),
    });

    yield* Scope.addFinalizer(
      scope,
      Effect.tryPromise({
        try: () => seaweedfs.stop(),
        catch: (error) => new Error(`Failed to stop SeaweedFS container: ${error}`),
      }).pipe(Effect.catchCause(() => Effect.void)),
    );

    const wings = yield* Effect.tryPromise({
      try: () =>
        new GenericContainer("docker.useairfoil.com/airfoil/wings:0.1.0-alpha.14")
          .withNetwork(network)
          .withCommand(["dev", "--grpc.address=0.0.0.0:7777"])
          .withEnvironment({
            RUST_LOG: "info",
            AWS_ACCESS_KEY_ID: "wingsdevaccesskey",
            AWS_SECRET_ACCESS_KEY: "wingsdevsecretkey",
            AWS_ENDPOINT: "http://seaweedfs:8333",
            AWS_BUCKET_NAME: "default-bucket",
            AWS_DEFAULT_REGION: "us-east-1",
            AWS_ALLOW_HTTP: "true",
          })
          .withExposedPorts(7777)
          .withWaitStrategy(Wait.forLogMessage(/Starting gRPC server/))
          .withStartupTimeout(60_000)
          .start(),
      catch: (error) => new Error(`Failed to start Wings container: ${error}`),
    });

    yield* Scope.addFinalizer(
      scope,
      Effect.tryPromise({
        try: () => wings.stop(),
        catch: (error) => new Error(`Failed to stop Wings container: ${error}`),
      }).pipe(Effect.catchCause(() => Effect.void)),
    );

    return {
      grpcHostAndPort: Effect.gen(function* () {
        const port = yield* Effect.sync(() => wings.getMappedPort(7777));
        const host = yield* Effect.sync(() => wings.getHost());
        return `${host}:${port}`;
      }),
    };
  }),
);
