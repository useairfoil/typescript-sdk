import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription(
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
  ({ name }) =>
    Effect.gen(function* () {
      const s = p.spinner();
      s.start("Fetching topic...");

      const topic = yield* ClusterClient.getTopic({ name }).pipe(
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to get topic"))),
      );

      s.stop("Topic retrieved");

      yield* Effect.sync(() => {
        printTable([
          {
            name: topic.name,
            description: topic.description || "-",
            partition_key:
              topic.partitionKey !== undefined
                ? (topic.schema.fields.find((f) => f.id === topic.partitionKey)?.name ??
                  topic.partitionKey.toString())
                : "-",
            freshness_seconds: topic.compaction.freshnessSeconds.toString(),
            ttl_seconds: topic.compaction.ttlSeconds?.toString() || "-",
          },
        ]);

        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("Get details of a specific topic"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
