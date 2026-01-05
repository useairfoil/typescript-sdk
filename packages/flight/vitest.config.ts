import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    // Suppress duplicate case warnings in generated protobuf files
    // These are caused by protobuf enum aliases and are harmless
    logOverride: {
      "duplicate-case": "silent",
    },
  },
});
