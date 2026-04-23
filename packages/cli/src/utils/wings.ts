import { Effect, FileSystem, Path } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const WINGS_DIR = join(homedir(), ".local", "share", "wings");
const GITHUB_RELEASES_URL = "https://github.com/useairfoil/wings/releases";

/**
 * Get the platform string for Wings binary naming
 * Examples: "aarch64-linux", "x86_64-linux", "aarch64-macos"
 */
function getPlatformString(): string {
  const platform = process.platform;
  const arch = process.arch;

  const archMap: Record<string, string> = {
    arm64: "aarch64",
    x64: "x86_64",
  };

  const osMap: Record<string, string> = {
    darwin: "macos",
    linux: "linux",
    win32: "windows",
  };

  const mappedArch = archMap[arch] || arch;
  const mappedOs = osMap[platform] || platform;

  return `${mappedArch}-${mappedOs}`;
}

/**
 * Get the binary filename based on platform and stress variant
 * Examples:
 * - "wings-aarch64-macos"
 * - "wings-stress-aarch64-linux"
 */
function getBinaryFilename(isStress: boolean): string {
  const platformString = getPlatformString();
  return isStress ? `wings-stress-${platformString}` : `wings-${platformString}`;
}

export const getWingsPath = (version: string, isStress = false) =>
  Effect.gen(function* () {
    const binaryFilename = getBinaryFilename(isStress);
    const path = yield* Path.Path;
    return path.join(WINGS_DIR, `${binaryFilename}-${version}`);
  });

export const downloadWings = (version: string, targetPath: string, isStress = false) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const client = yield* HttpClient.HttpClient;

    const filename = getBinaryFilename(isStress);

    const downloadPath = version === "latest" ? "latest/download" : `download/${version}`;
    const url = `${GITHUB_RELEASES_URL}/${downloadPath}/${filename}`;

    yield* fs.makeDirectory(WINGS_DIR, { recursive: true });

    const response = yield* client.get(url);
    const buffer = yield* HttpClientResponse.matchStatus({
      200: (response) => response.arrayBuffer,
      orElse: (response) => {
        throw new Error(`Failed to download Wings from ${url}: ${response.status}`);
      },
    })(response);

    yield* fs.writeFile(targetPath, new Uint8Array(buffer));

    yield* verifyChecksum(version, targetPath, isStress);

    yield* fs.chmod(targetPath, 0o755);
  });

/**
 * Download and verify the checksum of a Wings binary
 * The hash file format is: "<hash> <path>/wings"
 */
export const verifyChecksum = (version: string, filePath: string, isStress = false) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const client = yield* HttpClient.HttpClient;

    const filename = getBinaryFilename(isStress);
    const hashFilename = `${filename}-hash.txt`;

    const downloadPath = version === "latest" ? "latest/download" : `download/${version}`;
    const url = `${GITHUB_RELEASES_URL}/${downloadPath}/${hashFilename}`;

    const response = yield* client.get(url);
    const hashContent = yield* HttpClientResponse.matchStatus({
      200: (response) => response.text,
      orElse: (response) => {
        return Effect.fail(
          new Error(`Failed to download hash file from ${url}: ${response.status}`),
        );
      },
    })(response);

    const expectedChecksum = hashContent.trim().split(/\s+/)[0];

    if (!expectedChecksum) {
      return yield* Effect.fail(new Error("Invalid hash file format"));
    }

    const fileBuffer = yield* fs.readFile(filePath);

    const hash = createHash("sha256");
    hash.update(fileBuffer);
    const actualChecksum = hash.digest("hex");

    if (actualChecksum !== expectedChecksum) {
      return yield* Effect.fail(new Error("Wings binary checksum mismatch"));
    }
  });
