#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import packageJson from "../package.json";
import { clusterCommand } from "./commands/cluster/index";
import { devCommand } from "./commands/dev";
import { sqlCommand } from "./commands/sql";

const version = packageJson.version;

const program = Command.make("airfoil", {}, () => Effect.void).pipe(
  Command.withSubcommands([devCommand, sqlCommand, clusterCommand]),
);

const cli = Command.run(program, {
  version,
});

cli.pipe(
  Effect.provide(Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer)),
  Effect.scoped,
  NodeRuntime.runMain,
);
