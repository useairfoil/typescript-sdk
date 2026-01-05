import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type CreateObjectStoreGoogleOptions = ServerOptions & {
  parent: string;
  objectStoreId: string;
  bucketName: string;
  prefix?: string;
  serviceAccount: string;
  serviceAccountKey: string;
};

export const createObjectStoreGoogleCommand = new Command("google")
  .description("Create a new Google Cloud Storage object store")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant}",
  )
  .requiredOption(
    "--object-store-id <id>",
    "Unique identifier for the object store",
  )
  .requiredOption("--bucket-name <bucket>", "Google Cloud Storage bucket name")
  .option("--prefix <prefix>", "Bucket prefix (optional)")
  .requiredOption("--service-account <account>", "GOOGLE_SERVICE_ACCOUNT")
  .requiredOption("--service-account-key <key>", "GOOGLE_SERVICE_ACCOUNT_KEY")
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: CreateObjectStoreGoogleOptions) => {
    try {
      p.intro("🗄️  Create Google Cloud Storage Object Store");

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating Google Cloud Storage object store...");

      const result = await client.createObjectStore({
        parent: options.parent,
        objectStoreId: options.objectStoreId,
        objectStoreConfig: {
          _tag: "google",
          google: {
            bucketName: options.bucketName,
            prefix: options.prefix,
            serviceAccount: options.serviceAccount,
            serviceAccountKey: options.serviceAccountKey,
          },
        },
      });

      s.stop("Google Cloud Storage object store created successfully");

      printTable([
        {
          name: result.name,
          type: "Google Cloud",
          bucket: options.bucketName,
          service_account: options.serviceAccount,
        },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error
          ? error.message
          : "Failed to create Google object store",
      );
      process.exit(1);
    }
  });
