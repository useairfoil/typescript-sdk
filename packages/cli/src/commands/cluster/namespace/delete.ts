import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { forceOption, hostOption, portOption } from "../../../utils/options.js";

const nameOption = Options.text("name").pipe(
  Options.withDescription(
    "Namespace name in format: tenants/{tenant}/namespaces/{namespace}",
  ),
);

export const deleteNamespaceCommand = Command.make(
  "delete-namespace",
  {
    name: nameOption,
    force: forceOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, force, host, port }) =>
    Effect.gen(function* () {
      p.intro("🗑️  Delete Namespace");

      if (!force) {
        const confirm = yield* Effect.tryPromise({
          try: () =>
            p.confirm({
              message: `Are you sure you want to delete namespace ${name}?`,
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
      s.start("Deleting namespace...");

      yield* WingsClusterMetadata.deleteNamespace({ name }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to delete namespace")),
        ),
      );

      s.stop("Namespace deleted successfully");
      p.outro("✓ Done");
    }).pipe(Effect.catchAll(handleCliError("Failed to delete namespace"))),
).pipe(
  Command.withDescription(
    "Delete a namespace from the cluster (fails if namespace has any topics)",
  ),
);
