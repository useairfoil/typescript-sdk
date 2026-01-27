import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { forceOption, hostOption, portOption } from "../../../utils/options.js";

const nameOption = Options.text("name").pipe(
  Options.withDescription(
    "Object store name in format: tenants/{tenant}/object-stores/{object-store}",
  ),
);

export const deleteObjectStoreCommand = Command.make(
  "delete-object-store",
  {
    name: nameOption,
    force: forceOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, force, host, port }) =>
    Effect.gen(function* () {
      p.intro("🗑️  Delete Object Store");

      if (!force) {
        const confirm = yield* Effect.tryPromise({
          try: () =>
            p.confirm({
              message: `Are you sure you want to delete object store ${name}?`,
              initialValue: false,
            }),
          catch: () => new Error("Failed to confirm deletion"),
        });

        if (p.isCancel(confirm) || !confirm) {
          p.cancel("Deletion cancelled");
          process.exit(0);
        }
      }

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Deleting object store...");

      yield* WingsClusterMetadata.deleteObjectStore({ name }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to delete object store")),
        ),
      );

      s.stop("Object store deleted successfully");
      p.outro("✓ Done");
    }).pipe(Effect.catchAll(handleCliError("Failed to delete object store"))),
).pipe(Command.withDescription("Delete an object store from the cluster"));
