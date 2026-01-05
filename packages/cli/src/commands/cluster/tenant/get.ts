import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

type GetTenantOptions = ServerOptions & {
  name: string;
};

export const getTenantCommand = new Command("get-tenant")
  .description("Get details of a specific tenant")
  .requiredOption(
    "--name <name>",
    "Tenant name in format: tenants/{tenant} (e.g., 'tenants/acme-corp')",
  )
  .addOption(hostOption)
  .addOption(portOption)
  .action(async (options: GetTenantOptions) => {
    try {
      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Fetching tenant...");

      const tenant = await client.getTenant({
        name: options.name,
      });

      s.stop("Tenant retrieved");

      printTable([{ name: tenant.name }]);

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : "Failed to get tenant");
      process.exit(1);
    }
  });
