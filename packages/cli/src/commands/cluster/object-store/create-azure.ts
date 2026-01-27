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

const containerNameOption = Options.text("container-name").pipe(
  Options.withDescription("Azure container name"),
);

const prefixOption = Options.text("prefix").pipe(
  Options.withDescription("Container prefix (optional)"),
  Options.optional,
);

const storageAccountNameOption = Options.text("storage-account-name").pipe(
  Options.withDescription("AZURE_STORAGE_ACCOUNT_NAME"),
);

const storageAccountKeyOption = Options.text("storage-account-key").pipe(
  Options.withDescription("AZURE_STORAGE_ACCOUNT_KEY"),
);

export const createObjectStoreAzureCommand = Command.make(
  "azure",
  {
    parent: parentOption,
    objectStoreId: objectStoreIdOption,
    containerName: containerNameOption,
    prefix: prefixOption,
    storageAccountName: storageAccountNameOption,
    storageAccountKey: storageAccountKeyOption,
    host: hostOption,
    port: portOption,
  },
  ({
    parent,
    objectStoreId,
    containerName,
    prefix,
    storageAccountName,
    storageAccountKey,
    host,
    port,
  }) =>
    Effect.gen(function* () {
      p.intro("🗄️  Create Azure Blob Storage Object Store");

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Creating Azure object store...");

      const result = yield* WingsClusterMetadata.createObjectStore({
        parent,
        objectStoreId,
        objectStoreConfig: {
          _tag: "azure",
          azure: {
            containerName,
            prefix: Option.getOrUndefined(prefix),
            storageAccountName,
            storageAccountKey,
          },
        },
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to create Azure object store")),
        ),
      );

      s.stop("Azure object store created successfully");

      yield* Effect.sync(() => {
        printTable([
          {
            name: result.name,
            type: "Azure Blob",
            container: containerName,
            account: storageAccountName,
          },
        ]);
        p.outro("✓ Done");
      });
    }).pipe(
      Effect.catchAll(handleCliError("Failed to create Azure object store")),
    ),
).pipe(Command.withDescription("Create a new Azure Blob Storage object store"));
