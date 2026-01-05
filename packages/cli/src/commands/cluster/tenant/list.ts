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

export const listTenantsCommand = new Command("list-tenants")
  .description("List all tenants in the cluster")
  .addOption(pageSizeOption)
  .addOption(pageTokenOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: ServerAndPaginationOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching tenants...");

      const response = await client.listTenants({
        pageSize: Number.parseInt(options.pageSize, 10),
        pageToken: options.pageToken,
      });

      s.stop(`Found ${response.tenants.length} tenant(s)`);

      if (response.tenants.length === 0) {
        p.log.warn("No tenants found");
      } else {
        printTable(
          response.tenants.map((t: { name: string }) => ({ name: t.name })),
        );
      }

      if (response.nextPageToken) {
        p.log.info(`Next page token: ${response.nextPageToken}`);
      }

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to list tenants",
      );
      process.exit(1);
    }
  });
