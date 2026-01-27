import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command } from "@effect/cli";
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

export const listTenantsCommand = Command.make(
  "list-tenants",
  {
    pageSize: pageSizeOption,
    pageToken: pageTokenOption,
    host: hostOption,
    port: portOption,
  },
  ({ pageSize, pageToken, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching tenants...");

      const response = yield* WingsClusterMetadata.listTenants({
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to list tenants")),
        ),
      );

      s.stop(`Found ${response.tenants.length} tenant(s)`);

      yield* Effect.sync(() => {
        if (response.tenants.length === 0) {
          p.log.warn("No tenants found");
        } else {
          printTable(
            response.tenants.map((tenant: { name: string }) => ({
              name: tenant.name,
            })),
          );
        }

        if (response.nextPageToken) {
          p.log.info(`Next page token: ${response.nextPageToken}`);
        }

        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to list tenants"))),
).pipe(Command.withDescription("List all tenants in the cluster"));
