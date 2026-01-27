import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { hostOption, portOption } from "../../../utils/options.js";

const parentOption = Options.text("parent").pipe(
  Options.withDescription("Parent tenant in format: tenants/{tenant}"),
);

const objectStoreIdOption = Options.text("object-store-id").pipe(
  Options.withDescription("Unique identifier for the object store"),
);

const bucketNameOption = Options.text("bucket-name").pipe(
  Options.withDescription("S3 bucket name"),
);

const prefixOption = Options.text("prefix").pipe(
  Options.withDescription("Bucket prefix (optional)"),
  Options.optional,
);

const accessKeyIdOption = Options.text("access-key-id").pipe(
  Options.withDescription("AWS_ACCESS_KEY_ID"),
);

const secretAccessKeyOption = Options.text("secret-access-key").pipe(
  Options.withDescription("AWS_SECRET_ACCESS_KEY"),
);

const regionOption = Options.text("region").pipe(
  Options.withDescription("AWS_DEFAULT_REGION"),
  Options.optional,
);

const endpointOption = Options.text("endpoint").pipe(
  Options.withDescription(
    "AWS_ENDPOINT (e.g., https://nyc3.digitaloceanspaces.com)",
  ),
);

export const createObjectStoreS3Command = Command.make(
  "s3",
  {
    parent: parentOption,
    objectStoreId: objectStoreIdOption,
    bucketName: bucketNameOption,
    prefix: prefixOption,
    accessKeyId: accessKeyIdOption,
    secretAccessKey: secretAccessKeyOption,
    region: regionOption,
    endpoint: endpointOption,
    host: hostOption,
    port: portOption,
  },
  ({
    parent,
    objectStoreId,
    bucketName,
    prefix,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint,
    host,
    port,
  }) =>
    Effect.gen(function* () {
      p.intro("🗄️  Create S3-Compatible Object Store");

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Creating S3-compatible object store...");

      const result = yield* WingsClusterMetadata.createObjectStore({
        parent,
        objectStoreId,
        objectStoreConfig: {
          _tag: "s3Compatible",
          s3Compatible: {
            bucketName,
            prefix: Option.getOrUndefined(prefix),
            accessKeyId,
            secretAccessKey,
            region: Option.getOrUndefined(region),
            endpoint,
          },
        },
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() =>
            s.stop("Failed to create S3-compatible object store"),
          ),
        ),
      );

      s.stop("S3-compatible object store created successfully");

      yield* Effect.sync(() => {
        printTable([
          {
            name: result.name,
            type: "S3-Compatible",
            bucket: bucketName,
            endpoint,
          },
        ]);
        p.outro("✓ Done");
      });
    }).pipe(
      Effect.catchAll(
        handleCliError("Failed to create S3-compatible object store"),
      ),
    ),
).pipe(
  Command.withDescription(
    "Create a new S3-compatible object store (MinIO, DigitalOcean, etc.)",
  ),
);
