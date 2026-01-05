import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type CreateDataLakeIcebergOptions = ServerOptions & {
  parent: string;
  dataLakeId: string;
};

export const createDataLakeIcebergCommand = new Command("iceberg")
  .description("Create a new Iceberg data lake")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant}",
  )
  .requiredOption("--data-lake-id <id>", "Unique identifier for the data lake")
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: CreateDataLakeIcebergOptions) => {
    try {
      p.intro("🏞️  Create Iceberg Data Lake");

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating Iceberg data lake...");

      const result = await client.createDataLake({
        parent: options.parent,
        dataLakeId: options.dataLakeId,
        dataLakeConfig: {
          _tag: "iceberg",
          iceberg: {},
        },
      });

      s.stop("Iceberg data lake created successfully");

      printTable([
        {
          name: result.name,
          type: "Iceberg",
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
