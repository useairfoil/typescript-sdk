import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { forceOption, hostOption, portOption } from "../../../utils/options.js";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription("Data lake name in format: tenants/{tenant}/data-lakes/{data-lake}"),
);

export const deleteDataLakeCommand = Command.make(
  "delete-data-lake",
  {
    name: nameOption,
    force: forceOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, force, host, port }) =>
    Effect.gen(function* () {
      p.intro("🗑️  Delete Data Lake");

      if (!force) {
        const confirm = yield* Effect.tryPromise({
          try: () =>
            p.confirm({
              message: `Are you sure you want to delete data lake ${name}?`,
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
      s.start("Deleting data lake...");

      yield* WingsClusterMetadata.deleteDataLake({ name }).pipe(
        Effect.provide(layer),
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to delete data lake"))),
      );

      s.stop("Data lake deleted successfully");
      p.outro("✓ Done");
    }).pipe(Effect.catch(handleCliError("Failed to delete data lake"))),
).pipe(Command.withDescription("Delete a data lake from the cluster"));
