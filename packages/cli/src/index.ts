#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import packageJson from "../package.json";
import { catalogCommand } from "./commands/catalog";
import { namespaceCommand } from "./commands/namespace";
import { tableCommand } from "./commands/table";
import { OutputLogger } from "./utils/logger";
import { Output, WingsUri } from "./utils/options";

const version = packageJson.version;

const program = Command.make("airfoil", {}, () => Effect.void).pipe(
  Command.withSubcommands([catalogCommand, namespaceCommand, tableCommand]),
  Command.provide(OutputLogger),
  Command.withGlobalFlags([WingsUri, Output]),
);

const cli = Command.run(program, {
  version,
});

NodeRuntime.runMain(
  cli.pipe(
    Effect.provide(Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer)),
    Effect.scoped,
  ),
);
