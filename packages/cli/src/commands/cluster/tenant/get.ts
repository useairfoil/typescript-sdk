import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { hostOption, portOption } from "../../../utils/options.js";

const nameOption = Options.text("name").pipe(
  Options.withDescription(
    "Tenant name in format: tenants/{tenant} (e.g., 'tenants/acme-corp')",
  ),
);

export const getTenantCommand = Command.make(
  "get-tenant",
  {
    name: nameOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching tenant...");

      const tenant = yield* WingsClusterMetadata.getTenant({ name }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to get tenant")),
        ),
      );

      s.stop("Tenant retrieved");

      yield* Effect.sync(() => {
        printTable([{ name: tenant.name }]);
        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to get tenant"))),
).pipe(Command.withDescription("Get details of a specific tenant"));
