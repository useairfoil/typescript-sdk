import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, pageSizeOption, pageTokenOption, portOption } from "../../../utils/options";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent tenant in format: tenants/{tenant} (e.g., 'tenants/default')"),
);

export const listNamespacesCommand = Command.make(
  "list-namespaces",
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
      s.start("Fetching namespaces...");

      const response = yield* ClusterClient.listNamespaces({
        parent,
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to list namespaces"))));

      s.stop(`Found ${response.namespaces.length} namespace(s)`);

      yield* Effect.sync(() => {
        if (response.namespaces.length === 0) {
          p.log.warn("No namespaces found");
        } else {
          printTable(
            response.namespaces.map((namespace) => ({
              name: namespace.name,
              flush_size_bytes: namespace.flushSizeBytes.toString(),
              flush_interval_millis: namespace.flushIntervalMillis.toString(),
              object_store: namespace.objectStore || "-",
              data_lake: namespace.dataLake || "-",
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
  Command.withDescription("List all namespaces belonging to a tenant"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
