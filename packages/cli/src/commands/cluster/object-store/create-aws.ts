import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type CreateObjectStoreAwsOptions = ServerOptions & {
  parent: string;
  objectStoreId: string;
  bucketName: string;
  prefix?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export const createObjectStoreAwsCommand = new Command("aws")
  .description("Create a new AWS S3 object store")
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant}",
  )
  .requiredOption(
    "--object-store-id <id>",
    "Unique identifier for the object store",
  )
  .requiredOption("--bucket-name <bucket>", "AWS S3 bucket name")
  .option("--prefix <prefix>", "Bucket prefix (optional)")
  .requiredOption("--access-key-id <key>", "AWS_ACCESS_KEY_ID")
  .requiredOption("--secret-access-key <secret>", "AWS_SECRET_ACCESS_KEY")
  .option("--region <region>", "AWS_DEFAULT_REGION (e.g., us-east-1)")
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: CreateObjectStoreAwsOptions) => {
    try {
      p.intro("🗄️  Create AWS S3 Object Store");

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating AWS S3 object store...");

      const result = await client.createObjectStore({
        parent: options.parent,
        objectStoreId: options.objectStoreId,

        objectStoreConfig: {
          _tag: "aws",
          aws: {
            bucketName: options.bucketName,
            prefix: options.prefix,
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
            region: options.region,
          },
        },
      });

      s.stop("AWS S3 object store created successfully");

      printTable([
        {
          name: result.name,
          type: "AWS S3",
          bucket: options.bucketName,
          region: options.region || "-",
        },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error
          ? error.message
          : "Failed to create AWS object store",
      );
      process.exit(1);
    }
  });
