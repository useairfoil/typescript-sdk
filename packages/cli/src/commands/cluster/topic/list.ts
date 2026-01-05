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

type ListTopicsOptions = ServerAndPaginationOptions & {
  parent: string;
};

export const listTopicsCommand = new Command("list-topics")
  .description("List all topics belonging to a namespace")
  .requiredOption(
    "--parent <parent>",
    "Parent namespace in format: tenants/{tenant}/namespaces/{namespace}",
  )
  .addOption(pageSizeOption)
  .addOption(pageTokenOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: ListTopicsOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching topics...");

      const response = await client.listTopics({
        parent: options.parent,
        pageSize: Number.parseInt(options.pageSize, 10),
        pageToken: options.pageToken,
      });

      s.stop(`Found ${response.topics.length} topic(s)`);

      if (response.topics.length === 0) {
        p.log.warn("No topics found");
      } else {
        printTable(
          response.topics.map((t) => ({
            name: t.name,
            description: t.description || "-",
            partition_key: t.partitionKey?.toString() || "-",
          })),
        );
      }

      if (response.nextPageToken) {
        p.log.info(`Next page token: ${response.nextPageToken}`);
      }

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to list topics",
      );
      process.exit(1);
    }
  });
