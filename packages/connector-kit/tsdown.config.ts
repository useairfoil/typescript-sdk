import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/ingestion/index.ts",
    "src/publisher/index.ts",
    "src/streams/index.ts",
    "src/webhook/index.ts",
    "src/errors/index.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
