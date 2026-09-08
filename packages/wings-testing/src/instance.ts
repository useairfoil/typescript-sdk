import { Effect, Layer, Scope, Context } from "effect";
import { GenericContainer, Network, Wait } from "testcontainers";

export class Instance extends Context.Service<
  Instance,
  {
    readonly uri: Effect.Effect<string>;
    readonly icebergRestUri: Effect.Effect<string>;
  }
>()("@useairfoil/wings-testing/Instance") {}

/// A layer that uses an external Wings instance.
export const external = (args: { host?: string; port?: number; icebergRestUri?: string } = {}) => {
  const host = args.host ?? "localhost";
  const port = args.port ?? 7777;
  const icebergRestUri = args.icebergRestUri ?? "http://localhost:8181";

  return Layer.succeed(Instance, {
    uri: Effect.succeed(`http://${host}:${port}`),
    icebergRestUri: Effect.succeed(icebergRestUri),
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
            S3_TABLE_BUCKET: "default-catalog",
          })
          .withTmpFs({ "/data": "rw" })
          .withExposedPorts(8181)
          .withWaitStrategy(
            Wait.forAll([
              Wait.forLogMessage(/S3\s+ready/),
              Wait.forHttp("/v1/default-catalog/namespaces", 8181),
            ]),
          )
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

    const seaweedfsIp = seaweedfs.getIpAddress(network.getName());

    const wings = yield* Effect.tryPromise({
      try: () =>
        new GenericContainer("docker.useairfoil.com/airfoil/wings:0.1.0-alpha.15")
          .withNetwork(network)
          .withCommand(["dev", "--server.address=0.0.0.0:7777"])
          .withEnvironment({
            RUST_LOG: "debug",
            WINGS_OBJECT_STORE_TYPE: "aws",
            WINGS_OBJECT_STORE_BUCKET_NAME: "default-bucket",
            AWS_ACCESS_KEY_ID: "wingsdevaccesskey",
            AWS_SECRET_ACCESS_KEY: "wingsdevsecretkey",
            AWS_ENDPOINT: `http://${seaweedfsIp}:8333`,
            AWS_BUCKET_NAME: "default-bucket",
            AWS_DEFAULT_REGION: "us-east-1",
            AWS_ALLOW_HTTP: "true",
          })
          .withExposedPorts(7777)
          .withWaitStrategy(Wait.forLogMessage(/http server listening/))
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
      uri: Effect.gen(function* () {
        const port = yield* Effect.sync(() => wings.getMappedPort(7777));
        const host = yield* Effect.sync(() => wings.getHost());
        return `http://${host}:${port}`;
      }),
      icebergRestUri: Effect.succeed(`http://${seaweedfsIp}:8181`),
    };
  }),
);
