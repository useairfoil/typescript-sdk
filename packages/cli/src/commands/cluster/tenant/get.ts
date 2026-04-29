import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription("Tenant name in format: tenants/{tenant} (e.g., 'tenants/acme-corp')"),
);

export const getTenantCommand = Command.make(
  "get-tenant",
  {
    name: nameOption,
    host: hostOption,
    port: portOption,
  },
  ({ name }) =>
    Effect.gen(function* () {
      const s = p.spinner();
      s.start("Fetching tenant...");

      const tenant = yield* ClusterClient.getTenant({ name }).pipe(
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to get tenant"))),
      );

      s.stop("Tenant retrieved");

      yield* Effect.sync(() => {
        printTable([{ name: tenant.name }]);
        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("Get details of a specific tenant"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
