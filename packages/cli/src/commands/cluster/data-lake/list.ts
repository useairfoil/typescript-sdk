import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  pageSizeOption,
  pageTokenOption,
  portOption,
  type ServerAndPaginationOptions,
} from "../../../utils/options";

type ListDataLakesOptions = ServerAndPaginationOptions & {
  parent: string;
};

export const listDataLakesCommand = new Command("list-data-lakes")
  .description("List all data lakes belonging to a tenant")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant}",
  )
  .addOption(pageSizeOption)
  .addOption(pageTokenOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: ListDataLakesOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching data lakes...");

      const response = await client.listDataLakes({
        parent: options.parent,
        pageSize: Number.parseInt(options.pageSize, 10),
        pageToken: options.pageToken,
      });

      s.stop(`Found ${response.dataLakes.length} data lake(s)`);

      if (response.dataLakes.length === 0) {
        p.log.warn("No data lakes found");
      } else {
        printTable(
          response.dataLakes.map((dl) => ({
            name: dl.name,
            type: dl.dataLakeConfig._tag || "-",
          })),
        );
      }

      if (response.nextPageToken) {
        p.log.info(`Next page token: ${response.nextPageToken}`);
      }

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to list data lakes",
      );
      process.exit(1);
    }
  });
