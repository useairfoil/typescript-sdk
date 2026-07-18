import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import packageJson from "../package.json";
import { sandboxCommand } from "./sandbox";
import { startCommand } from "./start";

const BootstrapLayer = Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer);

const program = Command.make("producer-template", {}, () => Effect.void).pipe(
  Command.withSubcommands([startCommand, sandboxCommand]),
);

Command.run(program, { version: packageJson.version }).pipe(
  Effect.provide(BootstrapLayer),
  Effect.scoped,
  NodeRuntime.runMain,
);
