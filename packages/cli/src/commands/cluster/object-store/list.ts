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
  Options.withDescription("Parent tenant in format: tenants/{tenant}"),
);

export const listObjectStoresCommand = Command.make(
  "list-object-stores",
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
      s.start("Fetching object stores...");

      const response = yield* WingsClusterMetadata.listObjectStores({
        parent,
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to list object stores")),
        ),
      );

      s.stop(`Found ${response.objectStores.length} object store(s)`);

      yield* Effect.sync(() => {
        if (response.objectStores.length === 0) {
          p.log.warn("No object stores found");
        } else {
          printTable(
            response.objectStores.map(
              (objectStore: {
                name: string;
                objectStoreConfig: { _tag?: string | null };
              }) => ({
                name: objectStore.name,
                type: objectStore.objectStoreConfig._tag || "-",
              }),
            ),
          );
        }

        if (response.nextPageToken) {
          p.log.info(`Next page token: ${response.nextPageToken}`);
        }

        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to list object stores"))),
).pipe(Command.withDescription("List all object stores belonging to a tenant"));
