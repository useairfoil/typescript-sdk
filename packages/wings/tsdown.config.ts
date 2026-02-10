import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/Cluster.ts", "src/Schema.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  copy: ["proto"],
});
