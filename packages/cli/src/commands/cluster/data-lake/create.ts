import { Command } from "commander";
import { createDataLakeIcebergCommand } from "./create-iceberg.js";
import { createDataLakeParquetCommand } from "./create-parquet.js";

export const createDataLakeCommand = new Command("create-data-lake")
  .description("Create a new data lake")
  .addCommand(createDataLakeIcebergCommand)
  .addCommand(createDataLakeParquetCommand);
