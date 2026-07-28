import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/main.ts", "src/manifest.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
