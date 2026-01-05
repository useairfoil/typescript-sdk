import { $ } from "bun";

const targets = [
  { platform: "linux", arch: "x64" },
  { platform: "linux", arch: "arm64" },
  { platform: "darwin", arch: "x64" },
  { platform: "darwin", arch: "arm64" },
  { platform: "windows", arch: "x64" },
];

for (const { platform, arch } of targets) {
  const outfile = `dist/airfoil-${platform}-${arch}${platform === "windows" ? ".exe" : ""}`;

  console.log(`Compiling for ${platform}-${arch}...`);

  await $`bun build src/index.ts --compile --target=bun-${platform}-${arch} --outfile ${outfile}`;

  console.log(`✓ Created ${outfile}`);
}

console.log("\n✓ All binaries compiled successfully!");
