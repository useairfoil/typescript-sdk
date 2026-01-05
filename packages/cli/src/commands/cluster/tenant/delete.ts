import * as p from "@clack/prompts";
import { Command } from "commander";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  forceOption,
  hostOption,
  portOption,
  type ServerAndForceOptions,
} from "../../../utils/options";

type DeleteTenantOptions = ServerAndForceOptions & {
  name: string;
};

export const deleteTenantCommand = new Command("delete-tenant")
  .description(
    "Delete a tenant from the cluster (fails if tenant has any namespaces)",
  )
  .requiredOption(
    "--name <name>",
    "Tenant name in format: tenants/{tenant} (e.g., 'tenants/acme-corp')",
  )
  .addOption(forceOption)
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: DeleteTenantOptions) => {
    try {
      p.intro("🗑️  Delete Tenant");

      if (!options.force) {
        const confirm = await p.confirm({
          message: `Are you sure you want to delete tenant ${options.name}?`,
          initialValue: false,
        });

        if (p.isCancel(confirm) || !confirm) {
          p.cancel("Deletion cancelled");
          process.exit(0);
        }
      }

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Deleting tenant...");

      await client.deleteTenant({
        name: options.name,
      });

      s.stop("Tenant deleted successfully");
      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to delete tenant",
      );
      process.exit(1);
    }
  });
