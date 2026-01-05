import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const WINGS_DIR = join(homedir(), ".airfoil", "wings");
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
  return isStress
    ? `wings-stress-${platformString}`
    : `wings-${platformString}`;
}

export function getWingsPath(version: string, isStress = false): string {
  const binaryFilename = getBinaryFilename(isStress);
  return join(WINGS_DIR, `${binaryFilename}-${version}`);
}

export async function downloadWings(
  version: string,
  targetPath: string,
  isStress = false,
): Promise<void> {
  const filename = getBinaryFilename(isStress);

  const downloadPath =
    version === "latest" ? "latest/download" : `download/${version}`;
  const url = `${GITHUB_RELEASES_URL}/${downloadPath}/${filename}`;

  await Bun.$`mkdir -p ${WINGS_DIR}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download Wings from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = await response.arrayBuffer();
  await Bun.write(targetPath, buffer);
}

/**
 * Download and verify the checksum of a Wings binary
 * The hash file format is: "<hash> <path>/wings"
 */
export async function verifyChecksum(
  version: string,
  filePath: string,
  isStress = false,
): Promise<boolean> {
  const filename = getBinaryFilename(isStress);
  const hashFilename = `${filename}-hash.txt`;

  const downloadPath =
    version === "latest" ? "latest/download" : `download/${version}`;
  const hashUrl = `${GITHUB_RELEASES_URL}/${downloadPath}/${hashFilename}`;

  const hashResponse = await fetch(hashUrl);

  if (!hashResponse.ok) {
    throw new Error(
      `Failed to download hash file from ${hashUrl}: ${hashResponse.status} ${hashResponse.statusText}`,
    );
  }

  const hashContent = await hashResponse.text();

  const expectedChecksum = hashContent.trim().split(/\s+/)[0];

  if (!expectedChecksum) {
    throw new Error("Invalid hash file format");
  }

  const file = Bun.file(filePath);
  const buffer = await file.arrayBuffer();

  const hash = createHash("sha256");
  hash.update(new Uint8Array(buffer));
  const actualChecksum = hash.digest("hex");

  return actualChecksum === expectedChecksum;
}
