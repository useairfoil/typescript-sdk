import { Effect, String } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

export const checkDockerVersion = () =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const docker = ChildProcess.make("docker", ["--version"]);

    return yield* spawner.string(docker).pipe(Effect.map(String.trim));
  });

export const createDockerVolume = (volumeName: string) =>
  Effect.gen(function* () {
    const docker = yield* ChildProcess.make("docker", ["volume", "create", volumeName]);
    const exitCode = yield* docker.exitCode;
    if (exitCode !== 0) {
      return yield* Effect.fail(new Error(`Docker volume create failed with code ${exitCode}`));
    }
  });

export const createDockerNetwork = (networkName: string) =>
  Effect.gen(function* () {
    const docker = yield* ChildProcess.make("docker", ["network", "create", networkName]);
    const exitCode = yield* docker.exitCode;
    if (exitCode !== 0) {
      return yield* Effect.fail(new Error(`Docker network create failed with code ${exitCode}`));
    }
  });

export const removeDockerContainer = (containerName: string) =>
  Effect.gen(function* () {
    const docker = yield* ChildProcess.make("docker", ["rm", "-f", containerName], {
      stdout: "ignore",
      stderr: "ignore",
    });
    yield* docker.exitCode;
  });

export const removeDockerNetwork = (networkName: string) =>
  Effect.gen(function* () {
    const docker = yield* ChildProcess.make("docker", ["network", "rm", networkName], {
      stdout: "ignore",
      stderr: "ignore",
    });
    yield* docker.exitCode;
  });

export const pullDockerImage = (image: string) =>
  Effect.gen(function* () {
    const docker = yield* ChildProcess.make("docker", ["pull", image], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = yield* docker.exitCode;
    if (exitCode !== 0) {
      return yield* Effect.fail(new Error(`Docker pull failed with code ${exitCode}`));
    }
  });

export const runDockerContainer = (image: string, volumeName: string) =>
  Effect.gen(function* () {
    const networkName = "airfoil-dev";
    const seaweedContainerName = "airfoil-seaweedfs";

    yield* removeDockerContainer(seaweedContainerName);
    yield* removeDockerNetwork(networkName);
    yield* createDockerNetwork(networkName);
    yield* Effect.addFinalizer(() =>
      removeDockerNetwork(networkName).pipe(Effect.catchCause(() => Effect.void)),
    );

    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const seaweed = ChildProcess.make("docker", [
      "run",
      "-d",
      "--rm",
      "--name",
      seaweedContainerName,
      "--network",
      networkName,
      "--network-alias",
      "seaweedfs",
      "-e",
      "AWS_ACCESS_KEY_ID=wingsdevaccesskey",
      "-e",
      "AWS_SECRET_ACCESS_KEY=wingsdevsecretkey",
      "-e",
      "S3_BUCKET=default-bucket",
      "-v",
      `${volumeName}:/data`,
      "-p",
      "8333:8333",
      "chrislusf/seaweedfs:4.29",
      "weed",
      "mini",
      "-s3",
      "-dir=/data",
    ]);

    yield* spawner.string(seaweed).pipe(Effect.map(String.trim));
    yield* Effect.addFinalizer(() =>
      removeDockerContainer(seaweedContainerName).pipe(Effect.catchCause(() => Effect.void)),
    );

    const docker = yield* ChildProcess.make("docker", [
      "run",
      "-it",
      "--rm",
      "--name",
      "wings-dev",
      "--network",
      networkName,
      "-e",
      "AWS_ACCESS_KEY_ID=wingsdevaccesskey",
      "-e",
      "AWS_SECRET_ACCESS_KEY=wingsdevsecretkey",
      "-e",
      "AWS_ENDPOINT=http://seaweedfs:8333",
      "-e",
      "AWS_BUCKET_NAME=default-bucket",
      "-e",
      "AWS_DEFAULT_REGION=us-east-1",
      "-e",
      "AWS_ALLOW_HTTP=true",
      "-p",
      "7777:7777",
      image,
      "dev",
      "--grpc.address=0.0.0.0:7777",
    ]);

    const exitCode = yield* docker.exitCode;

    if (exitCode !== 0) {
      return yield* Effect.fail(new Error(`Docker process exited with code ${exitCode}`));
    }
  });
