import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

const tenantIdOption = Flag.string("tenant-id").pipe(
  Flag.withDescription("Unique identifier for the tenant (e.g., 'acme-corp')"),
);

export const createTenantCommand = Command.make(
  "create-tenant",
  {
    tenantId: tenantIdOption,
    host: hostOption,
    port: portOption,
  },
  ({ tenantId }) =>
    Effect.gen(function* () {
      p.intro("🏢 Create Tenant");

      const s = p.spinner();
      s.start("Creating tenant...");

      const tenant = yield* ClusterClient.createTenant({
        tenantId,
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to create tenant"))));

      s.stop("Tenant created successfully");

      yield* Effect.sync(() => {
        printTable([{ name: tenant.name }]);
        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("Create a new tenant in the cluster"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
