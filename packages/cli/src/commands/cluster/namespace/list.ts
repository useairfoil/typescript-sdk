import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, pageSizeOption, pageTokenOption, portOption } from "../../../utils/options";

export const listNamespacesCommand = Command.make(
  "list-namespaces",
  {
    pageSize: pageSizeOption,
    pageToken: pageTokenOption,
    host: hostOption,
    port: portOption,
  },
  ({ pageSize, pageToken }) =>
    Effect.gen(function* () {
      const s = p.spinner();
      s.start("Fetching namespaces...");

      const response = yield* ClusterClient.listNamespaces({
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
              object_store: namespace.objectStore?.objectStoreConfig._tag ?? "-",
              lake: namespace.lake?.lakeConfig._tag ?? "-",
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
  Command.withDescription("List all namespaces in the cluster"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
