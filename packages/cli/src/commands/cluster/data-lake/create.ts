import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createDataLakeIcebergCommand } from "./create-iceberg";
import { createDataLakeParquetCommand } from "./create-parquet";

export const createDataLakeCommand = Command.make("create-data-lake", {}, () => Effect.void).pipe(
  Command.withDescription("Create a new data lake"),
  Command.withSubcommands([createDataLakeIcebergCommand, createDataLakeParquetCommand]),
);
