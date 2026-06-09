import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription("Table name in format: namespaces/{namespace}/tables/{table}"),
);

export const getTableCommand = Command.make(
  "get-table",
  {
    name: nameOption,
    host: hostOption,
    port: portOption,
  },
  ({ name }) =>
    Effect.gen(function* () {
      const s = p.spinner();
      s.start("Fetching table...");

      const table = yield* ClusterClient.getTable({ name }).pipe(
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to get table"))),
      );

      s.stop("Table retrieved");

      yield* Effect.sync(() => {
        printTable([
          {
            name: table.name,
            description: table.description || "-",
            key_field_id: table.keyFieldId.toString(),
            version_field_id: table.versionFieldId.toString(),
            partition_field_id: table.partitionFieldId?.toString() || "-",
            freshness_seconds: table.targetFreshnessSeconds.toString(),
          },
        ]);

        if (table.schema.fields.length > 0) {
          console.log("\nFields:");
          printTable(
            table.schema.fields.map((field) => ({
              name: field.name,
              id: field.id.toString(),
              type: field.arrowType?._tag ?? "unknown",
              nullable: field.nullable ? "yes" : "no",
            })),
          );
        }

        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("Get details of a specific table"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
