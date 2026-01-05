import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type GetTopicOptions = ServerOptions & {
  name: string;
};

export const getTopicCommand = new Command("get-topic")
  .description("Get details of a specific topic")
  .requiredOption(
    "--name <name>",
    "Topic name in format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}",
  )
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: GetTopicOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching topic...");

      const topic = await client.getTopic({
        name: options.name,
      });

      s.stop("Topic retrieved");

      printTable([
        {
          name: topic.name,
          description: topic.description || "-",
          partition_key: topic.partitionKey?.toString() || "-",
          freshness_seconds:
            topic.compaction?.freshnessSeconds.toString() || "-",
          ttl_seconds: topic.compaction?.ttlSeconds?.toString() || "-",
        },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : "Failed to get topic");
      process.exit(1);
    }
  });
