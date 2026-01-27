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
  Options.withDescription("Google Cloud Storage bucket name"),
);

const prefixOption = Options.text("prefix").pipe(
  Options.withDescription("Bucket prefix (optional)"),
  Options.optional,
);

const serviceAccountOption = Options.text("service-account").pipe(
  Options.withDescription("GOOGLE_SERVICE_ACCOUNT"),
);

const serviceAccountKeyOption = Options.text("service-account-key").pipe(
  Options.withDescription("GOOGLE_SERVICE_ACCOUNT_KEY"),
);

export const createObjectStoreGoogleCommand = Command.make(
  "google",
  {
    parent: parentOption,
    objectStoreId: objectStoreIdOption,
    bucketName: bucketNameOption,
    prefix: prefixOption,
    serviceAccount: serviceAccountOption,
    serviceAccountKey: serviceAccountKeyOption,
    host: hostOption,
    port: portOption,
  },
  ({
    parent,
    objectStoreId,
    bucketName,
    prefix,
    serviceAccount,
    serviceAccountKey,
    host,
    port,
  }) =>
    Effect.gen(function* () {
      p.intro("🗄️  Create Google Cloud Storage Object Store");

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Creating Google Cloud Storage object store...");

      const result = yield* WingsClusterMetadata.createObjectStore({
        parent,
        objectStoreId,
        objectStoreConfig: {
          _tag: "google",
          google: {
            bucketName,
            prefix: Option.getOrUndefined(prefix),
            serviceAccount,
            serviceAccountKey,
          },
        },
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to create Google object store")),
        ),
      );

      s.stop("Google Cloud Storage object store created successfully");

      yield* Effect.sync(() => {
        printTable([
          {
            name: result.name,
            type: "Google Cloud",
            bucket: bucketName,
            service_account: serviceAccount,
          },
        ]);
        p.outro("✓ Done");
      });
    }).pipe(
      Effect.catchAll(handleCliError("Failed to create Google object store")),
    ),
).pipe(
  Command.withDescription("Create a new Google Cloud Storage object store"),
);
