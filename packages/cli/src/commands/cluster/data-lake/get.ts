import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type GetDataLakeOptions = ServerOptions & {
  name: string;
};

export const getDataLakeCommand = new Command("get-data-lake")
  .description("Get details of a specific data lake")
  .requiredOption(
    "--name <name>",
    "Data lake name in format: tenants/{tenant}/data-lakes/{data-lake}",
  )
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: GetDataLakeOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching data lake...");

      const dataLake = await client.getDataLake({
        name: options.name,
      });

      s.stop("Data lake retrieved");

      printTable([
        { name: dataLake.name, type: dataLake.dataLakeConfig._tag || "-" },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to get data lake",
      );
      process.exit(1);
    }
  });
