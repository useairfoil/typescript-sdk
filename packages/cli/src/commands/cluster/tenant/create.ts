import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { hostOption, portOption } from "../../../utils/options.js";

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
  ({ tenantId, host, port }) =>
    Effect.gen(function* () {
      p.intro("🏢 Create Tenant");

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Creating tenant...");

      const tenant = yield* WingsClusterMetadata.createTenant({
        tenantId,
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to create tenant"))),
      );

      s.stop("Tenant created successfully");

      yield* Effect.sync(() => {
        printTable([{ name: tenant.name }]);
        p.outro("✓ Done");
      });
    }),
).pipe(Command.withDescription("Create a new tenant in the cluster"));
