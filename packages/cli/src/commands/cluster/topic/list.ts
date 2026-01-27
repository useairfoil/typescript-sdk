import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import {
  hostOption,
  pageSizeOption,
  pageTokenOption,
  portOption,
} from "../../../utils/options.js";

const parentOption = Options.text("parent").pipe(
  Options.withDescription(
    "Parent namespace in format: tenants/{tenant}/namespaces/{namespace}",
  ),
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
  ({ parent, pageSize, pageToken, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching topics...");

      const response = yield* WingsClusterMetadata.listTopics({
        parent,
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to list topics")),
        ),
      );

      s.stop(`Found ${response.topics.length} topic(s)`);

      yield* Effect.sync(() => {
        if (response.topics.length === 0) {
          p.log.warn("No topics found");
        } else {
          printTable(
            response.topics.map(
              (topic: {
                name: string;
                description?: string | null;
                partitionKey?: number | null;
              }) => ({
                name: topic.name,
                description: topic.description || "-",
                partition_key: topic.partitionKey?.toString() || "-",
              }),
            ),
          );
        }

        if (response.nextPageToken) {
          p.log.info(`Next page token: ${response.nextPageToken}`);
        }

        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to list topics"))),
).pipe(Command.withDescription("List all topics belonging to a namespace"));
