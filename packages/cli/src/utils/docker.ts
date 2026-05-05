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
    const docker = yield* ChildProcess.make("docker", [
      "run",
      "-it",
      "--rm",
      "--name",
      "wings-dev",
      "-v",
      `${volumeName}:/tmp`,
      "-p",
      "7777:7777",
      "-p",
      "7780:7780",
      image,
      "dev",
      "--http.address=0.0.0.0:7780",
      "--metadata.address=0.0.0.0:7777",
    ]);

    const exitCode = yield* docker.exitCode;

    if (exitCode !== 0) {
      return yield* Effect.fail(new Error(`Docker process exited with code ${exitCode}`));
    }
  });
