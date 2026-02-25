import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/vcr/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
