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

const bucketNameOption = Flag.string("bucket-name").pipe(
  Flag.withDescription("Google Cloud Storage bucket name"),
);

const prefixOption = Flag.string("prefix").pipe(
  Flag.withDescription("Bucket prefix (optional)"),
  Flag.optional,
);

const serviceAccountOption = Flag.string("service-account").pipe(
  Flag.withDescription("GOOGLE_SERVICE_ACCOUNT"),
);

const serviceAccountKeyOption = Flag.string("service-account-key").pipe(
  Flag.withDescription("GOOGLE_SERVICE_ACCOUNT_KEY"),
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
  ({ parent, objectStoreId, bucketName, prefix, serviceAccount, serviceAccountKey, host, port }) =>
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
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to create Google object store"))),
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
    }),
).pipe(Command.withDescription("Create a new Google Cloud Storage object store"));
