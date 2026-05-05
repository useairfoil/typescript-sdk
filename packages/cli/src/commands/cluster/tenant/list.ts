import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, pageSizeOption, pageTokenOption, portOption } from "../../../utils/options";

export const listTenantsCommand = Command.make(
  "list-tenants",
  {
    pageSize: pageSizeOption,
    pageToken: pageTokenOption,
    host: hostOption,
    port: portOption,
  },
  ({ pageSize, pageToken }) =>
    Effect.gen(function* () {
      const s = p.spinner();
      s.start("Fetching tenants...");

      const response = yield* ClusterClient.listTenants({
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to list tenants"))));

      s.stop(`Found ${response.tenants.length} tenant(s)`);

      yield* Effect.sync(() => {
        if (response.tenants.length === 0) {
          p.log.warn("No tenants found");
        } else {
          printTable(response.tenants.map((tenant) => ({ name: tenant.name })));
        }

        if (response.nextPageToken) {
          p.log.info(`Next page token: ${response.nextPageToken}`);
        }

        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("List all tenants in the cluster"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
