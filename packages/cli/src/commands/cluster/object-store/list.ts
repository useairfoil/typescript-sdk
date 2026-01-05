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

type ListObjectStoresOptions = ServerAndPaginationOptions & {
  parent: string;
};

export const listObjectStoresCommand = new Command("list-object-stores")
  .description("List all object stores belonging to a tenant")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant}",
  )
  .addOption(pageSizeOption)
  .addOption(pageTokenOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: ListObjectStoresOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching object stores...");

      const response = await client.listObjectStores({
        parent: options.parent,
        pageSize: Number.parseInt(options.pageSize, 10),
        pageToken: options.pageToken,
      });

      s.stop(`Found ${response.objectStores.length} object store(s)`);

      if (response.objectStores.length === 0) {
        p.log.warn("No object stores found");
      } else {
        printTable(
          response.objectStores.map((os) => ({
            name: os.name,
            type: os.objectStoreConfig._tag || "-",
          })),
        );
      }

      if (response.nextPageToken) {
        p.log.info(`Next page token: ${response.nextPageToken}`);
      }

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to list object stores",
      );
      process.exit(1);
    }
  });
