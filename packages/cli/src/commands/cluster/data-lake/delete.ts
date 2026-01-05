import * as p from "@clack/prompts";
import { Command } from "commander";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  forceOption,
  hostOption,
  portOption,
  type ServerAndForceOptions,
} from "../../../utils/options";

type DeleteDataLakeOptions = ServerAndForceOptions & {
  name: string;
};

export const deleteDataLakeCommand = new Command("delete-data-lake")
  .description("Delete a data lake from the cluster")
  .requiredOption(
    "--name <name>",
    "Data lake name in format: tenants/{tenant}/data-lakes/{data-lake}",
  )
  .addOption(forceOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: DeleteDataLakeOptions) => {
    try {
      p.intro("🗑️  Delete Data Lake");

      if (!options.force) {
        const confirm = await p.confirm({
          message: `Are you sure you want to delete data lake ${options.name}?`,
          initialValue: false,
        });

        if (p.isCancel(confirm) || !confirm) {
          p.cancel("Deletion cancelled");
          process.exit(0);
        }
      }

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Deleting data lake...");

      await client.deleteDataLake({
        name: options.name,
      });

      s.stop("Data lake deleted successfully");
      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to delete data lake",
      );
      process.exit(1);
    }
  });
