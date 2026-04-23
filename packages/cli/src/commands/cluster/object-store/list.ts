import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { hostOption, pageSizeOption, pageTokenOption, portOption } from "../../../utils/options.js";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent tenant in format: tenants/{tenant}"),
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
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to list object stores"))),
      );

      s.stop(`Found ${response.objectStores.length} object store(s)`);

      yield* Effect.sync(() => {
        if (response.objectStores.length === 0) {
          p.log.warn("No object stores found");
        } else {
          printTable(
            response.objectStores.map(
              (objectStore: { name: string; objectStoreConfig: { _tag?: string | null } }) => ({
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
    }),
).pipe(Command.withDescription("List all object stores belonging to a tenant"));
