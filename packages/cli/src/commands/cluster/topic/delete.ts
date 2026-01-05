import * as p from "@clack/prompts";
import { Command } from "commander";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  forceOption,
  hostOption,
  portOption,
  type ServerAndForceOptions,
} from "../../../utils/options";

type DeleteTopicOptions = ServerAndForceOptions & {
  name: string;
  forceDelete: boolean;
};

export const deleteTopicCommand = new Command("delete-topic")
  .description("Delete a topic from the cluster")
  .requiredOption(
    "--name <name>",
    "Topic name in format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}",
  )
  .option("--force-delete", "Also delete data associated with the topic", false)
  .addOption(forceOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: DeleteTopicOptions) => {
    try {
      p.intro("🗑️  Delete Topic");

      if (!options.force) {
        const confirm = await p.confirm({
          message: `Are you sure you want to delete topic ${options.name}?${options.forceDelete ? " (including all data)" : ""}`,
          initialValue: false,
        });

        if (p.isCancel(confirm) || !confirm) {
          p.cancel("Deletion cancelled");
          process.exit(0);
        }
      }

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Deleting topic...");

      await client.deleteTopic({
        name: options.name,
        force: options.forceDelete,
      });

      s.stop("Topic deleted successfully");
      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to delete topic",
      );
      process.exit(1);
    }
  });
