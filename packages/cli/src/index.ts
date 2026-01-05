#!/usr/bin/env bun
import { Command } from "commander";
import { clusterCommand } from "./commands/cluster/index.js";
import { devCommand } from "./commands/dev.js";
import { sqlCommand } from "./commands/sql.js";

const program = new Command();

program
  .name("airfoil")
  .description("Airfoil CLI - Manage your Wings deployments")
  .version("0.1.0");

program.addCommand(devCommand);
program.addCommand(sqlCommand);
program.addCommand(clusterCommand);

program.parse();
