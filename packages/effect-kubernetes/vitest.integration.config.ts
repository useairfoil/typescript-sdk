import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/integration/**/*.integration.ts"],
    fileParallelism: false,
    testTimeout: 300_000,
  },
});
