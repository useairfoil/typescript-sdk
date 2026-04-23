import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { hostOption, portOption } from "../../../utils/options.js";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent tenant in format: tenants/{tenant}"),
);

const objectStoreIdOption = Flag.string("object-store-id").pipe(
  Flag.withDescription("Unique identifier for the object store"),
);

const bucketNameOption = Flag.string("bucket-name").pipe(Flag.withDescription("S3 bucket name"));

const prefixOption = Flag.string("prefix").pipe(
  Flag.withDescription("Bucket prefix (optional)"),
  Flag.optional,
);

const accessKeyIdOption = Flag.string("access-key-id").pipe(
  Flag.withDescription("AWS_ACCESS_KEY_ID"),
);

const secretAccessKeyOption = Flag.string("secret-access-key").pipe(
  Flag.withDescription("AWS_SECRET_ACCESS_KEY"),
);

const regionOption = Flag.string("region").pipe(
  Flag.withDescription("AWS_DEFAULT_REGION"),
  Flag.optional,
);

const endpointOption = Flag.string("endpoint").pipe(
  Flag.withDescription("AWS_ENDPOINT (e.g., https://nyc3.digitaloceanspaces.com)"),
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
            allowHttp: false,
          },
        },
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to create S3-compatible object store")),
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
    }),
).pipe(
  Command.withDescription("Create a new S3-compatible object store (MinIO, DigitalOcean, etc.)"),
);
