import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import packageJson from "../package.json";
import { createTableCommand } from "./create-table";
import { sandboxCommand } from "./sandbox";
import { startCommand } from "./start";

const BootstrapLayer = Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer);

const program = Command.make("producer-shopify", {}, () => Effect.void).pipe(
  Command.withSubcommands([startCommand, sandboxCommand, createTableCommand]),
);

const cli = Command.run(program, { version: packageJson.version });

NodeRuntime.runMain(cli.pipe(Effect.provide(BootstrapLayer), Effect.scoped));
