import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type CreateDataLakeParquetOptions = ServerOptions & {
  parent: string;
  dataLakeId: string;
};

export const createDataLakeParquetCommand = new Command("parquet")
  .description("Create a new Parquet data lake")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant}",
  )
  .requiredOption("--data-lake-id <id>", "Unique identifier for the data lake")
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: CreateDataLakeParquetOptions) => {
    try {
      p.intro("🏞️  Create Parquet Data Lake");

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating Parquet data lake...");

      const result = await client.createDataLake({
        parent: options.parent,
        dataLakeId: options.dataLakeId,
        dataLakeConfig: {
          _tag: "parquet",
          parquet: {},
        },
      });

      s.stop("Parquet data lake created successfully");

      printTable([
        {
          name: result.name,
          type: "Parquet",
        },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to create data lake",
      );
      process.exit(1);
    }
  });
