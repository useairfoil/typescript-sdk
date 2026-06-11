import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { forceOption, hostOption, portOption } from "../../../utils/options";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription("Table name in format: namespaces/{namespace}/tables/{table}"),
);

export const deleteTableCommand = Command.make(
  "delete-table",
  {
    name: nameOption,
    force: forceOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, force }) =>
    Effect.gen(function* () {
      p.intro("🗑️  Delete Table");

      if (!force) {
        const confirm = yield* Effect.tryPromise({
          try: () =>
            p.confirm({
              message: `Are you sure you want to delete table ${name}?`,
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
      s.start("Deleting table...");

      yield* ClusterClient.deleteTable({ name }).pipe(
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to delete table"))),
      );

      s.stop("Table deleted successfully");
      p.outro("✓ Done");
    }),
).pipe(
  Command.withDescription("Delete a table from the cluster"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
