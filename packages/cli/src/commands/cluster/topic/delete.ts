import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { forceOption, hostOption, portOption } from "../../../utils/options.js";

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
  ({ name, forceDelete, force, host, port }) =>
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
          process.exit(0);
        }
      }

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Deleting topic...");

      yield* WingsClusterMetadata.deleteTopic({
        name,
        force: forceDelete,
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to delete topic"))),
      );

      s.stop("Topic deleted successfully");
      p.outro("✓ Done");
    }).pipe(Effect.catch(handleCliError("Failed to delete topic"))),
).pipe(Command.withDescription("Delete a topic from the cluster"));
