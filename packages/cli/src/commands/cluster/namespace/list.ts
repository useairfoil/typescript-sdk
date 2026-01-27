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
    "Parent tenant in format: tenants/{tenant} (e.g., 'tenants/default')",
  ),
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
  ({ parent, pageSize, pageToken, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching namespaces...");

      const response = yield* WingsClusterMetadata.listNamespaces({
        parent,
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to list namespaces")),
        ),
      );

      s.stop(`Found ${response.namespaces.length} namespace(s)`);

      yield* Effect.sync(() => {
        if (response.namespaces.length === 0) {
          p.log.warn("No namespaces found");
        } else {
          printTable(
            response.namespaces.map(
              (namespace: {
                name: string;
                flushSizeBytes: bigint;
                flushIntervalMillis: bigint;
                objectStore?: string | null;
                dataLake?: string | null;
              }) => ({
                name: namespace.name,
                flush_size_bytes: namespace.flushSizeBytes.toString(),
                flush_interval_millis: namespace.flushIntervalMillis.toString(),
                object_store: namespace.objectStore || "-",
                data_lake: namespace.dataLake || "-",
              }),
            ),
          );
        }

        if (response.nextPageToken) {
          p.log.info(`Next page token: ${response.nextPageToken}`);
        }

        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to list namespaces"))),
).pipe(Command.withDescription("List all namespaces belonging to a tenant"));
