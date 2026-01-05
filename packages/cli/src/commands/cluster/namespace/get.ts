import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type GetNamespaceOptions = ServerOptions & {
  name: string;
};

export const getNamespaceCommand = new Command("get-namespace")
  .description("Get details of a specific namespace")
  .requiredOption(
    "--name <name>",
    "Namespace name in format: tenants/{tenant}/namespaces/{namespace}",
  )
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: GetNamespaceOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching namespace...");

      const namespace = await client.getNamespace({
        name: options.name,
      });

      s.stop("Namespace retrieved");

      printTable([
        {
          name: namespace.name,
          flush_size_bytes: namespace.flushSizeBytes.toString(),
          flush_interval_millis: namespace.flushIntervalMillis.toString(),
          object_store: namespace.objectStore || "-",
          data_lake: namespace.dataLake || "-",
        },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to get namespace",
      );
      process.exit(1);
    }
  });
