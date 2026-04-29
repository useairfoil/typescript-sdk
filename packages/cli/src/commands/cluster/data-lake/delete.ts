import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { forceOption, hostOption, portOption } from "../../../utils/options";

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
  ({ name, force }) =>
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
          return;
        }
      }

      const s = p.spinner();
      s.start("Deleting data lake...");

      yield* ClusterClient.deleteDataLake({ name }).pipe(
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to delete data lake"))),
      );

      s.stop("Data lake deleted successfully");
      p.outro("✓ Done");
    }),
).pipe(
  Command.withDescription("Delete a data lake from the cluster"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
