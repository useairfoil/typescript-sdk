import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cluster/index.ts", "src/schema/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  copy: ["proto"],
});
