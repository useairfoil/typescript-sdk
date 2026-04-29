import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { forceOption, hostOption, portOption } from "../../../utils/options";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription(
    "Topic name in format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}",
  ),
);

const forceDeleteOption = Flag.boolean("force-delete").pipe(
  Flag.withDescription("Also delete data associated with the topic"),
  Flag.withDefault(false),
);

export const deleteTopicCommand = Command.make(
  "delete-topic",
  {
    name: nameOption,
    forceDelete: forceDeleteOption,
    force: forceOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, forceDelete, force }) =>
    Effect.gen(function* () {
      p.intro("🗑️  Delete Topic");

      if (!force) {
        const confirm = yield* Effect.tryPromise({
          try: () =>
            p.confirm({
              message: `Are you sure you want to delete topic ${name}?${forceDelete ? " (including all data)" : ""}`,
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
      s.start("Deleting topic...");

      yield* ClusterClient.deleteTopic({
        name,
        force: forceDelete,
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to delete topic"))));

      s.stop("Topic deleted successfully");
      p.outro("✓ Done");
    }),
).pipe(
  Command.withDescription("Delete a topic from the cluster"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
