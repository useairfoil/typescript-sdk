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
  Options.withDescription("AWS S3 bucket name"),
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
  Options.withDescription("AWS_DEFAULT_REGION (e.g., us-east-1)"),
  Options.optional,
);

export const createObjectStoreAwsCommand = Command.make(
  "aws",
  {
    parent: parentOption,
    objectStoreId: objectStoreIdOption,
    bucketName: bucketNameOption,
    prefix: prefixOption,
    accessKeyId: accessKeyIdOption,
    secretAccessKey: secretAccessKeyOption,
    region: regionOption,
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
    host,
    port,
  }) =>
    Effect.gen(function* () {
      p.intro("🗄️  Create AWS S3 Object Store");

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Creating AWS S3 object store...");

      const result = yield* WingsClusterMetadata.createObjectStore({
        parent,
        objectStoreId,
        objectStoreConfig: {
          _tag: "aws",
          aws: {
            bucketName,
            prefix: Option.getOrUndefined(prefix),
            accessKeyId,
            secretAccessKey,
            region: Option.getOrUndefined(region),
          },
        },
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to create AWS object store")),
        ),
      );

      s.stop("AWS S3 object store created successfully");

      yield* Effect.sync(() => {
        printTable([
          {
            name: result.name,
            type: "AWS S3",
            bucket: bucketName,
            region: Option.getOrUndefined(region) || "-",
          },
        ]);
        p.outro("✓ Done");
      });
    }).pipe(
      Effect.catchAll(handleCliError("Failed to create AWS object store")),
    ),
).pipe(Command.withDescription("Create a new AWS S3 object store"));
