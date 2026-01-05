import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type CreateTenantOptions = ServerOptions & {
  tenantId: string;
};

export const createTenantCommand = new Command("create-tenant")
  .description("Create a new tenant in the cluster")
  .requiredOption(
    "--tenant-id <id>",
    "Unique identifier for the tenant (e.g., 'acme-corp')",
  )
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: CreateTenantOptions) => {
    try {
      p.intro("🏢 Create Tenant");

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating tenant...");

      const tenant = await client.createTenant({
        tenantId: options.tenantId,
      });

      s.stop("Tenant created successfully");

      printTable([{ name: tenant.name }]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to create tenant",
      );
      process.exit(1);
    }
  });
