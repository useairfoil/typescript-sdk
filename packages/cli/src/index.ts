#!/usr/bin/env bun
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import packageJson from "../package.json";
import { clusterCommand } from "./commands/cluster/index.js";
import { devCommand } from "./commands/dev.js";
import { sqlCommand } from "./commands/sql.js";

const version = packageJson.version;

const program = Command.make("airfoil", {}, () => Effect.void).pipe(
  Command.withSubcommands([devCommand, sqlCommand, clusterCommand]),
);

const cli = Command.run(program, {
  version,
});

cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
