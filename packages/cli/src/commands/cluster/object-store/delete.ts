import * as p from "@clack/prompts";
import { Command } from "commander";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  forceOption,
  hostOption,
  portOption,
  type ServerAndForceOptions,
} from "../../../utils/options";

type DeleteObjectStoreOptions = ServerAndForceOptions & {
  name: string;
};

export const deleteObjectStoreCommand = new Command("delete-object-store")
  .description("Delete an object store from the cluster")
  .requiredOption(
    "--name <name>",
    "Object store name in format: tenants/{tenant}/object-stores/{object-store}",
  )
  .addOption(forceOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: DeleteObjectStoreOptions) => {
    try {
      p.intro("🗑️  Delete Object Store");

      if (!options.force) {
        const confirm = await p.confirm({
          message: `Are you sure you want to delete object store ${options.name}?`,
          initialValue: false,
        });

        if (p.isCancel(confirm) || !confirm) {
          p.cancel("Deletion cancelled");
          process.exit(0);
        }
      }

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Deleting object store...");

      await client.deleteObjectStore({
        name: options.name,
      });

      s.stop("Object store deleted successfully");
      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error
          ? error.message
          : "Failed to delete object store",
      );
      process.exit(1);
    }
  });
