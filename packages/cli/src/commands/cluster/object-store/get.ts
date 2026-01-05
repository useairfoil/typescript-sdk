import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type GetObjectStoreOptions = ServerOptions & {
  name: string;
};

export const getObjectStoreCommand = new Command("get-object-store")
  .description("Get details of a specific object store")
  .requiredOption(
    "--name <name>",
    "Object store name in format: tenants/{tenant}/object-stores/{object-store}",
  )
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: GetObjectStoreOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching object store...");

      const objectStore = await client.getObjectStore({
        name: options.name,
      });

      s.stop("Object store retrieved");

      printTable([
        {
          name: objectStore.name,
          type: objectStore.objectStoreConfig._tag || "-",
        },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to get object store",
      );
      process.exit(1);
    }
  });
