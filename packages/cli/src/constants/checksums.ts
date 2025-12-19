export const CHECKSUMS = {
  x64: {
    latest: "abc123...",
    "0.1.0-beta.8": "def456...",
    "0.1.0-beta.7": "ghi789...",
  },
  arm64: {
    latest: "jkl012...",
    "0.1.0-beta.8": "mno345...",
    "0.1.0-beta.7": "pqr678...",
  },
} as const;

type SupportedArch = keyof typeof CHECKSUMS;

export function getChecksum(arch: string, version: string): string | undefined {
  if (arch in CHECKSUMS) {
    const archChecksums = CHECKSUMS[arch as SupportedArch];
    return archChecksums[version as keyof typeof archChecksums];
  }
  return undefined;
}
