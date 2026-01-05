import * as p from "@clack/prompts";
import { Command } from "commander";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  forceOption,
  hostOption,
  portOption,
  type ServerAndForceOptions,
} from "../../../utils/options";

type DeleteNamespaceOptions = ServerAndForceOptions & {
  name: string;
};

export const deleteNamespaceCommand = new Command("delete-namespace")
  .description(
    "Delete a namespace from the cluster (fails if namespace has any topics)",
  )
  .requiredOption(
    "--name <name>",
    "Namespace name in format: tenants/{tenant}/namespaces/{namespace}",
  )
  .addOption(forceOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: DeleteNamespaceOptions) => {
    try {
      p.intro("🗑️  Delete Namespace");

      if (!options.force) {
        const confirm = await p.confirm({
          message: `Are you sure you want to delete namespace ${options.name}?`,
          initialValue: false,
        });

        if (p.isCancel(confirm) || !confirm) {
          p.cancel("Deletion cancelled");
          process.exit(0);
        }
      }

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Deleting namespace...");

      await client.deleteNamespace({
        name: options.name,
      });

      s.stop("Namespace deleted successfully");
      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to delete namespace",
      );
      process.exit(1);
    }
  });
