import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, pageSizeOption, pageTokenOption, portOption } from "../../../utils/options";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent namespace in format: tenants/{tenant}/namespaces/{namespace}"),
);

export const listTopicsCommand = Command.make(
  "list-topics",
  {
    parent: parentOption,
    pageSize: pageSizeOption,
    pageToken: pageTokenOption,
    host: hostOption,
    port: portOption,
  },
  ({ parent, pageSize, pageToken }) =>
    Effect.gen(function* () {
      const s = p.spinner();
      s.start("Fetching topics...");

      const response = yield* ClusterClient.listTopics({
        parent,
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to list topics"))));

      s.stop(`Found ${response.topics.length} topic(s)`);

      yield* Effect.sync(() => {
        if (response.topics.length === 0) {
          p.log.warn("No topics found");
        } else {
          printTable(
            response.topics.map((topic) => ({
              name: topic.name,
              description: topic.description || "-",
              partition_key:
                topic.partitionKey !== undefined
                  ? (topic.schema.fields.find((f) => f.id === topic.partitionKey)?.name ??
                    topic.partitionKey.toString())
                  : "-",
            })),
          );
        }

        if (response.nextPageToken) {
          p.log.info(`Next page token: ${response.nextPageToken}`);
        }

        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("List all topics belonging to a namespace"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
