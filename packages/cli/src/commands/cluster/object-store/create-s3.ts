import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type CreateObjectStoreS3Options = ServerOptions & {
  parent: string;
  objectStoreId: string;
  bucketName: string;
  prefix?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  endpoint: string;
};

export const createObjectStoreS3Command = new Command("s3")
  .description(
    "Create a new S3-compatible object store (MinIO, DigitalOcean, etc.)",
  )
  .requiredOption(
    "--parent <parent>",
    "Parent tenant in format: tenants/{tenant}",
  )
  .requiredOption(
    "--object-store-id <id>",
    "Unique identifier for the object store",
  )
  .requiredOption("--bucket-name <bucket>", "S3 bucket name")
  .option("--prefix <prefix>", "Bucket prefix (optional)")
  .requiredOption("--access-key-id <key>", "AWS_ACCESS_KEY_ID")
  .requiredOption("--secret-access-key <secret>", "AWS_SECRET_ACCESS_KEY")
  .option("--region <region>", "AWS_DEFAULT_REGION")
  .requiredOption(
    "--endpoint <endpoint>",
    "AWS_ENDPOINT (e.g., https://nyc3.digitaloceanspaces.com)",
  )
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: CreateObjectStoreS3Options) => {
    try {
      p.intro("🗄️  Create S3-Compatible Object Store");

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating S3-compatible object store...");

      const result = await client.createObjectStore({
        parent: options.parent,
        objectStoreId: options.objectStoreId,
        objectStoreConfig: {
          _tag: "s3Compatible",
          s3Compatible: {
            bucketName: options.bucketName,
            prefix: options.prefix,
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
            region: options.region,
            endpoint: options.endpoint,
          },
        },
      });

      s.stop("S3-compatible object store created successfully");

      printTable([
        {
          name: result.name,
          type: "S3-Compatible",
          bucket: options.bucketName,
          endpoint: options.endpoint,
        },
      ]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error
          ? error.message
          : "Failed to create S3-compatible object store",
      );
      process.exit(1);
    }
  });
