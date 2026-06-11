import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/arrow/index.ts",
    "src/cluster/index.ts",
    "src/cluster-client/index.ts",
    "src/data-plane/index.ts",
    "src/errors/index.ts",
    "src/schema/index.ts",
    "src/utils/partition-value.ts",
    "src/utils/proto-utils.ts",
    "src/utils/table-utils.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  copy: ["proto"],
});
