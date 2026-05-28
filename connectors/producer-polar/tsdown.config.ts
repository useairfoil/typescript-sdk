import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/api.ts", "src/connector.ts", "src/schemas.ts", "src/main.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
