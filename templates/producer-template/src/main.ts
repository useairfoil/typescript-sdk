import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/cli";
import { FetchHttpClient } from "effect/http";

import packageJson from "../package.json";
import { sandboxCommand } from "./sandbox";
import { startCommand } from "./start";

const BootstrapLayer = Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer);

const program = Command.make("producer-template", {}, () => Effect.void).pipe(
  Command.withSubcommands([startCommand, sandboxCommand]),
);

const cli = Command.run(program, { version: packageJson.version });

NodeRuntime.runMain(cli.pipe(Effect.provide(BootstrapLayer), Effect.scoped));
