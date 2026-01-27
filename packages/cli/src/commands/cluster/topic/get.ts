import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { hostOption, portOption } from "../../../utils/options.js";

const nameOption = Options.text("name").pipe(
  Options.withDescription(
    "Topic name in format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}",
  ),
);

export const getTopicCommand = Command.make(
  "get-topic",
  {
    name: nameOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching topic...");

      const topic = yield* WingsClusterMetadata.getTopic({ name }).pipe(
        Effect.provide(layer),
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to get topic"))),
      );

      s.stop("Topic retrieved");

      yield* Effect.sync(() => {
        printTable([
          {
            name: topic.name,
            description: topic.description || "-",
            partition_key: topic.partitionKey?.toString() || "-",
            freshness_seconds: topic.compaction.freshnessSeconds.toString(),
            ttl_seconds: topic.compaction.ttlSeconds?.toString() || "-",
          },
        ]);

        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to get topic"))),
).pipe(Command.withDescription("Get details of a specific topic"));
