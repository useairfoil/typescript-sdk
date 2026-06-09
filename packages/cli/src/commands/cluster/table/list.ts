import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, pageSizeOption, pageTokenOption, portOption } from "../../../utils/options";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent namespace in format: namespaces/{namespace}"),
);

export const listTablesCommand = Command.make(
  "list-tables",
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
      s.start("Fetching tables...");

      const response = yield* ClusterClient.listTables({
        parent,
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to list tables"))));

      s.stop(`Found ${response.tables.length} table(s)`);

      yield* Effect.sync(() => {
        if (response.tables.length === 0) {
          p.log.warn("No tables found");
        } else {
          printTable(
            response.tables.map((table) => ({
              name: table.name,
              description: table.description || "-",
              key_field_id: table.keyFieldId.toString(),
              partition_field_id: table.partitionFieldId?.toString() || "-",
              freshness_seconds: table.targetFreshnessSeconds.toString(),
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
  Command.withDescription("List all tables belonging to a namespace"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
