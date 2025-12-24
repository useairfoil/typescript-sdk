import * as p from "@clack/prompts";
import { Command } from "commander";
import { downloadWings, getWingsPath, verifyChecksum } from "../utils/wings.js";

export const devCommand = new Command("dev")
  .description(
    "Download and run Wings dev server locally (Docker recommended for portability)",
  )
  .option("--docker", "Run Wings using Docker (recommended)")
  .option(
    "--version <version>",
    "Specify Wings version (e.g., v0.1.0-alpha.11 or 'latest')",
    "latest",
  )
  .option("--tag <tag>", "Docker image tag (only with --docker)", "latest")
  .option("--force-pull", "Force pull Docker image even if it exists locally")
  .option("--stress", "Use Wings stress binary variant")
  .option("-y, --yes", "Skip confirmation prompts")
  .action(async (options) => {
    try {
      if (options.docker) {
        await runWithDocker(options);
      } else {
        await runWithBinary(options);
      }
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : "Operation failed");
      process.exit(1);
    }
  });

async function runWithBinary(options: {
  version?: string;
  yes?: boolean;
  stress?: boolean;
}) {
  p.intro("🪽 Airfoil Dev");

  const version = options.version || "latest";
  const isStress = options.stress || false;
  const wingsPath = getWingsPath(version, isStress);
  const fileExists = await Bun.file(wingsPath).exists();

  if (!fileExists) {
    p.log.warn(
      `Wings${isStress ? " stress" : ""} binary not found for version ${version}`,
    );

    if (!options.yes) {
      const confirm = await p.confirm({
        message: `Download Wings${isStress ? " stress" : ""} ${version} binary? (~100MB)`,
        initialValue: true,
      });

      if (p.isCancel(confirm) || !confirm) {
        p.cancel("Download cancelled");
        process.exit(0);
      }
    }

    const s = p.spinner();
    s.start(`Downloading Wings${isStress ? " stress" : ""} ${version}...`);

    try {
      await downloadWings(version, wingsPath, isStress);
      s.stop(`Downloaded Wings${isStress ? " stress" : ""} ${version}`);
    } catch (error) {
      s.stop("Download failed");
      throw error;
    }

    const s2 = p.spinner();
    s2.start("Verifying checksum...");

    try {
      const isValid = await verifyChecksum(version, wingsPath, isStress);

      if (!isValid) {
        s2.stop("Checksum verification failed");
        throw new Error(
          "Binary checksum does not match expected value. This could indicate a corrupted download or security issue.",
        );
      }

      s2.stop("Checksum verified ✓");
    } catch (error) {
      s2.stop("Checksum verification failed");
      throw error;
    }

    await Bun.$`chmod +x ${wingsPath}`;
  } else {
    p.log.success(
      `Using cached Wings${isStress ? " stress" : ""} binary (${version})`,
    );
  }

  p.log.info("Starting Wings dev server...");

  const proc = Bun.spawn([wingsPath, "dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  await proc.exited;
}

async function runWithDocker(options: { tag?: string; forcePull?: boolean }) {
  p.intro("🐳 Airfoil Dev (Docker)");

  let tag = options.tag || "latest";

  // If tag is not "latest" and doesn't include architecture, append it
  // Format: 0.1.0-alpha.10-aarch64 or 0.1.0-alpha.10-x86_64
  if (tag !== "latest" && !tag.includes("aarch64") && !tag.includes("x86_64")) {
    const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
    // Remove 'v' prefix if present for docker tags
    const cleanTag = tag.startsWith("v") ? tag.substring(1) : tag;
    tag = `${cleanTag}-${arch}`;
  }

  const image = `docker.useairfoil.com/airfoil/wings:${tag}`;

  p.log.info(`Using Docker image: ${image}`);
  p.log.info("Ports: 7777 (metadata), 7780 (http)");

  try {
    await Bun.$`docker --version`.quiet();
  } catch {
    p.cancel(
      "Docker is not installed or not running. Please install Docker first.",
    );
    process.exit(1);
  }

  let imageExists = false;
  if (!options.forcePull) {
    try {
      const result = await Bun.$`docker images -q ${image}`.text();
      imageExists = result.trim().length > 0;
    } catch {
      imageExists = false;
    }
  }

  if (!imageExists || options.forcePull) {
    const s = p.spinner();
    s.start(
      options.forcePull
        ? "Pulling latest Docker image..."
        : "Downloading Docker image...",
    );

    try {
      await Bun.$`docker pull ${image}`.quiet();
      s.stop("Docker image ready");
    } catch (error) {
      s.stop("Failed to pull image");
      p.cancel(
        "Could not download Docker image. Please check your internet connection and registry access.",
      );
      process.exit(1);
    }
  } else {
    p.log.success("Using cached Docker image");
  }

  try {
    await Bun.$`docker volume create wings-data`.quiet();
  } catch {
    // volume may already exist, that's fine
  }

  p.log.info("Starting Wings dev server...");

  const proc = Bun.spawn(
    [
      "docker",
      "run",
      "-it",
      "--rm",
      "--name",
      "wings-dev",
      "-v",
      "wings-data:/tmp",
      "-p",
      "7777:7777",
      "-p",
      "7780:7780",
      image,
      "dev",
      "--http-address=0.0.0.0:7780",
      "--metadata-address=0.0.0.0:7777",
    ],
    {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    },
  );

  await proc.exited;
}
