import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const WINGS_DIR = join(homedir(), ".airfoil", "wings");
const GITHUB_RELEASES_URL =
  "https://github.com/usearifoil/wings/releases/download";

export function getWingsPath(version: string): string {
  const platform = process.platform;
  const arch = process.arch;
  const ext = platform === "win32" ? ".exe" : "";
  return join(WINGS_DIR, `wings-${version}-${platform}-${arch}${ext}`);
}

export async function downloadWings(
  version: string,
  targetPath: string,
): Promise<void> {
  const platform = process.platform;
  const arch = process.arch;
  const ext = platform === "win32" ? ".exe" : "";

  const filename = `wings-${platform}-${arch}${ext}`;
  const url = `${GITHUB_RELEASES_URL}/v${version}/${filename}`;

  await Bun.$`mkdir -p ${WINGS_DIR}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download Wings: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await Bun.write(targetPath, buffer);
}

export async function verifyChecksum(
  filePath: string,
  expectedChecksum: string,
): Promise<boolean> {
  const file = Bun.file(filePath);
  const buffer = await file.arrayBuffer();

  const hash = createHash("sha256");
  hash.update(new Uint8Array(buffer));
  const actualChecksum = hash.digest("hex");

  return actualChecksum === expectedChecksum;
}
