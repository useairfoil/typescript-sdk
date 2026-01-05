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

type ListNamespacesOptions = ServerAndPaginationOptions & {
  parent: string;
};

export const listNamespacesCommand = new Command("list-namespaces")
  .description("List all namespaces belonging to a tenant")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant} (e.g., 'tenants/default')",
  )
  .addOption(pageSizeOption)
  .addOption(pageTokenOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: ListNamespacesOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching namespaces...");

      const response = await client.listNamespaces({
        parent: options.parent,
        pageSize: Number.parseInt(options.pageSize, 10),
        pageToken: options.pageToken,
      });

      s.stop(`Found ${response.namespaces.length} namespace(s)`);

      if (response.namespaces.length === 0) {
        p.log.warn("No namespaces found");
      } else {
        printTable(
          response.namespaces.map((ns) => ({
            name: ns.name,
            flush_size_bytes: ns.flushSizeBytes.toString(),
            flush_interval_millis: ns.flushIntervalMillis.toString(),
            object_store: ns.objectStore || "-",
            data_lake: ns.dataLake || "-",
          })),
        );
      }

      if (response.nextPageToken) {
        p.log.info(`Next page token: ${response.nextPageToken}`);
      }

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to list namespaces",
      );
      process.exit(1);
    }
  });
