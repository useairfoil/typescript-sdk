import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Add a setup file to wait for the container to be ready and closed
    setupFiles: ["./test/setup.ts"],
  },
});
