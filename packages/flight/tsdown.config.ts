import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "test/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  copy: ["proto"],
  external: ["testcontainers"],
});
