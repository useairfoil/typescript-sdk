import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { forceOption, hostOption, portOption } from "../../../utils/options.js";

const nameOption = Options.text("name").pipe(
  Options.withDescription(
    "Tenant name in format: tenants/{tenant} (e.g., 'tenants/acme-corp')",
  ),
);

export const deleteTenantCommand = Command.make(
  "delete-tenant",
  {
    name: nameOption,
    force: forceOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, force, host, port }) =>
    Effect.gen(function* () {
      p.intro("🗑️  Delete Tenant");

      if (!force) {
        const confirm = yield* Effect.tryPromise({
          try: () =>
            p.confirm({
              message: `Are you sure you want to delete tenant ${name}?`,
              initialValue: false,
            }),
          catch: () => new Error("Failed to confirm deletion"),
        });

        if (p.isCancel(confirm) || !confirm) {
          p.cancel("Deletion cancelled");
          process.exit(0);
        }
      }

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Deleting tenant...");

      yield* WingsClusterMetadata.deleteTenant({ name }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to delete tenant")),
        ),
      );

      s.stop("Tenant deleted successfully");
      p.outro("✓ Done");
    }).pipe(Effect.catchAll(handleCliError("Failed to delete tenant"))),
).pipe(
  Command.withDescription(
    "Delete a tenant from the cluster (fails if tenant has any namespaces)",
  ),
);
