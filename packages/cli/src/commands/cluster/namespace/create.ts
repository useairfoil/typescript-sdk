import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type CreateNamespaceOptions = ServerOptions & {
  parent: string;
  namespaceId: string;
  flushSizeBytes: string;
  flushIntervalMillis: string;
  objectStore: string;
  dataLake: string;
};

export const createNamespaceCommand = new Command("create-namespace")
  .description("Create a new namespace belonging to a tenant")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant} (e.g., 'tenants/default')",
  )
  .requiredOption(
    "--namespace-id <id>",
    "Unique identifier for the namespace (e.g., 'production')",
  )
  .option(
    "--flush-size-bytes <bytes>",
    "Size at which the current segment is flushed to object storage",
    "0",
  )
  .option(
    "--flush-interval-millis <millis>",
    "Maximum interval at which the current segment is flushed (milliseconds)",
    "0",
  )
  .requiredOption(
    "--object-store <name>",
    "Object store used by this namespace (format: tenants/{tenant}/object-stores/{object-store})",
  )
  .requiredOption(
    "--data-lake <name>",
    "Data lake used by this namespace (format: tenants/{tenant}/data-lakes/{data-lake})",
  )
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: CreateNamespaceOptions) => {
    try {
      p.intro("📁 Create Namespace");

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating namespace...");

      const namespace = await client.createNamespace({
        parent: options.parent,
        namespaceId: options.namespaceId,
        flushSizeBytes: BigInt(options.flushSizeBytes),
        flushIntervalMillis: BigInt(options.flushIntervalMillis),
        objectStore: options.objectStore,
        dataLake: options.dataLake,
      });

      s.stop("Namespace created successfully");

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
        error instanceof Error ? error.message : "Failed to create namespace",
      );
      process.exit(1);
    }
  });
