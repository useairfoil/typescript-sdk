import * as p from "@clack/prompts";
import { Command } from "commander";

export const devCommand = new Command("dev")
  .description("Download and run Wings dev server locally")
  .option("--docker", "Run Wings using Docker (recommended for now)")
  .option("--version <version>", "Specify Wings version", "v0.1.0-alpha.9")
  .option("--checksum <checksum>", "Verify binary checksum (optional override)")
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
  checksum?: string;
  yes?: boolean;
}) {
  p.intro("🪽 Airfoil Dev");

  p.log.warn("⚠️  Binary downloads are coming soon!");
  p.log.info("For now, please use Docker to run Wings:");
  p.log.info("  airfoil dev --docker");
  p.outro("💡 Docker is the recommended way to run Wings locally");
  process.exit(0);

  /*
  const version = options.version || "latest";
  const wingsPath = getWingsPath(version);
  const fileExists = await Bun.file(wingsPath).exists();

  if (!fileExists) {
    p.log.warn(`Wings binary not found for version ${version}`);

    if (!options.yes) {
      const confirm = await p.confirm({
        message: `Download Wings ${version} binary? (~50MB)`,
        initialValue: true,
      });

      if (p.isCancel(confirm) || !confirm) {
        p.cancel("Download cancelled");
        process.exit(0);
      }
    }

    const s = p.spinner();
    s.start(`Downloading Wings ${version}...`);

    try {
      await downloadWings(version, wingsPath);
      s.stop(`Downloaded Wings ${version}`);
    } catch (error) {
      s.stop("Download failed");
      throw error;
    }

    const expectedChecksum =
      options.checksum || getChecksum(process.arch, version);

    if (expectedChecksum) {
      const s2 = p.spinner();
      s2.start("Verifying checksum...");

      const isValid = await verifyChecksum(wingsPath, expectedChecksum);

      if (!isValid) {
        s2.stop("Checksum verification failed");
        throw new Error(
          "Binary checksum does not match expected value. This could indicate a corrupted download or security issue.",
        );
      }

      s2.stop("Checksum verified ✓");
    } else {
      p.log.warn(
        "No checksum available for verification. Proceeding with caution...",
      );
    }

    await Bun.$`chmod +x ${wingsPath}`;
  }

  p.log.info("Starting Wings dev server...");
  const proc = Bun.spawn([wingsPath, "dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  await proc.exited;
  */
}

async function runWithDocker(options: { version?: string }) {
  p.intro("🐳 Airfoil Dev (Docker)");

  const version = options.version || "v0.1.0-alpha.9";

  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  const image = `ghcr.io/useairfoil/wings:${version}-${arch}`;

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
  try {
    const result = await Bun.$`docker images -q ${image}`.text();
    imageExists = result.trim().length > 0;
  } catch {
    imageExists = false;
  }

  if (!imageExists) {
    const s = p.spinner();
    s.start("Downloading Docker image...");

    try {
      await Bun.$`docker pull ${image}`.quiet();
      s.stop("Docker image ready");
    } catch (error) {
      s.stop("Failed to pull image");
      p.cancel(
        "Could not download Docker image. Please check your internet connection.",
      );
      process.exit(1);
    }
  } else {
    p.log.success("Using cached Docker image");
  }

  try {
    await Bun.$`docker volume create wings-data`.quiet();
  } catch {
    // Volume might already exist, that's fine
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
