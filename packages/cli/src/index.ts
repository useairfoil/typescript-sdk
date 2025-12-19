#!/usr/bin/env bun
import { Command } from "commander";
import { devCommand } from "./commands/dev";

const program = new Command();

program
  .name("airfoil")
  .description("Airfoil CLI - Manage your Wings deployments")
  .version("0.1.0");

program.addCommand(devCommand);

program.parse();
