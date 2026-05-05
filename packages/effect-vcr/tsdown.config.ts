import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/cassette-store.ts",
    "src/file-system-cassette-store.ts",
    "src/types.ts",
    "src/vcr-http-client.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
