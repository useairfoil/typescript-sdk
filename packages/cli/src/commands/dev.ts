import { Effect, FileSystem } from "effect";
import { Command, Flag, Prompt } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { checkDockerVersion, createDockerVolume, runDockerContainer } from "../utils/docker";
import { downloadWings, getWingsPath } from "../utils/wings";

const dockerOption = Flag.boolean("docker").pipe(
  Flag.withDescription("Run Wings using Docker (recommended)"),
  Flag.withDefault(false),
);

const versionOption = Flag.string("version").pipe(
  Flag.withDescription("Specify Wings version (e.g., v0.1.0-alpha.11 or 'latest')"),
  Flag.withDefault("latest"),
);

const tagOption = Flag.string("tag").pipe(
  Flag.withDescription("Docker image tag (only with --docker)"),
  Flag.withDefault("latest"),
);

const forcePullOption = Flag.boolean("force-pull").pipe(
  Flag.withDescription("Force pull Docker image even if it exists locally"),
  Flag.withDefault(false),
);

const stressOption = Flag.boolean("stress").pipe(
  Flag.withDescription("Use Wings stress binary variant"),
  Flag.withDefault(false),
);

const yesOption = Flag.boolean("yes").pipe(
  Flag.withAlias("y"),
  Flag.withDescription("Skip confirmation prompts"),
  Flag.withDefault(false),
);

export const devCommand = Command.make(
  "dev",
  {
    docker: dockerOption,
    version: versionOption,
    tag: tagOption,
    forcePull: forcePullOption,
    stress: stressOption,
    yes: yesOption,
  },
  (options) => (options.docker ? runWithDocker(options) : runWithBinary(options)),
).pipe(
  Command.withDescription(
    "Download and run Wings dev server locally (Docker recommended for portability)",
  ),
);

const runWithBinary = (options: { version: string; yes: boolean; stress: boolean }) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const fs = yield* FileSystem.FileSystem;

    yield* Effect.logInfo("🪽 Airfoil Dev");

    const version = options.version;
    const isStress = options.stress;
    const wingsPath = yield* getWingsPath(version, isStress);
    const exists = yield* fs.exists(wingsPath);

    if (!exists) {
      yield* Effect.logWarning(
        `Wings${isStress ? " stress" : ""} binary not found for version ${version}`,
      );

      if (!options.yes) {
        const confirm = yield* Prompt.confirm({
          message: `Download Wings${isStress ? " stress" : ""} ${version} binary? (~100MB)`,
          initial: true,
        });

        if (!confirm) {
          return yield* Effect.fail(new Error("Download cancelled"));
        }
      }

      yield* Effect.logInfo(`Downloading Wings${isStress ? " stress" : ""} ${version}...`);

      yield* downloadWings(version, wingsPath, isStress);
    } else {
      yield* Effect.logInfo(`Using cached Wings${isStress ? " stress" : ""} binary (${version})`);
    }

    yield* Effect.logInfo(`Starting Wings dev server...`);

    const proc = ChildProcess.make(wingsPath, ["dev"], {
      stdin: "inherit",
      stdout: "inherit",
    });

    const handle = yield* spawner.spawn(proc);

    const exitCode = yield* handle.exitCode;

    if (exitCode !== 0) {
      yield* Effect.fail(new Error(`Process exited with code ${exitCode}`));
    }
  });

const runWithDocker = (options: { tag: string; forcePull: boolean }) =>
  Effect.gen(function* () {
    yield* Effect.logInfo("🐳 Airfoil Dev (Docker)");

    let tag = options.tag;

    // If tag is not "latest" and doesn't include architecture, append it
    // Format: 0.1.0-alpha.10-aarch64 or 0.1.0-alpha.10-x86_64
    if (tag !== "latest" && !tag.includes("aarch64") && !tag.includes("x86_64")) {
      const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
      // Remove 'v' prefix if present for docker tags
      const cleanTag = tag.startsWith("v") ? tag.substring(1) : tag;
      tag = `${cleanTag}-${arch}`;
    }

    const image = `docker.useairfoil.com/airfoil/wings:${tag}`;

    yield* Effect.logInfo(`Using Docker image: ${image}`);
    yield* Effect.logInfo("Ports: 7777 (gRPC), 7780 (http)");

    yield* checkDockerVersion();

    yield* createDockerVolume("wings-data");

    yield* runDockerContainer(image, "wings-data");
  });
