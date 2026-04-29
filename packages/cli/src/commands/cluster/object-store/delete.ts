import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { forceOption, hostOption, portOption } from "../../../utils/options";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription(
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
  ({ name, force }) =>
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
          return;
        }
      }

      const s = p.spinner();
      s.start("Deleting object store...");

      yield* ClusterClient.deleteObjectStore({ name }).pipe(
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to delete object store"))),
      );

      s.stop("Object store deleted successfully");
      p.outro("✓ Done");
    }),
).pipe(
  Command.withDescription("Delete an object store from the cluster"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
