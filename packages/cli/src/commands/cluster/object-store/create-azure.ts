import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type CreateObjectStoreAzureOptions = ServerOptions & {
  parent: string;
  objectStoreId: string;
  containerName: string;
  prefix?: string;
  storageAccountName: string;
  storageAccountKey: string;
};

export const createObjectStoreAzureCommand = new Command("azure")
  .description("Create a new Azure Blob Storage object store")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant}",
  )
  .requiredOption(
    "--object-store-id <id>",
    "Unique identifier for the object store",
  )
  .requiredOption("--container-name <container>", "Azure container name")
  .option("--prefix <prefix>", "Container prefix (optional)")
  .requiredOption("--storage-account-name <name>", "AZURE_STORAGE_ACCOUNT_NAME")
  .requiredOption("--storage-account-key <key>", "AZURE_STORAGE_ACCOUNT_KEY")
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: CreateObjectStoreAzureOptions) => {
    try {
      p.intro("🗄️  Create Azure Blob Storage Object Store");

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating Azure object store...");

      const result = await client.createObjectStore({
        parent: options.parent,
        objectStoreId: options.objectStoreId,
        objectStoreConfig: {
          _tag: "azure",
          azure: {
            containerName: options.containerName,
            prefix: options.prefix,
            storageAccountName: options.storageAccountName,
            storageAccountKey: options.storageAccountKey,
          },
        },
      });

      s.stop("Azure object store created successfully");

      printTable([
        {
          name: result.name,
          type: "Azure Blob",
          container: options.containerName,
          account: options.storageAccountName,
        },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error
          ? error.message
          : "Failed to create Azure object store",
      );
      process.exit(1);
    }
  });
