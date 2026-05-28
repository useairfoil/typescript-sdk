import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import packageJson from "../package.json";
import { sandboxCommand } from "./sandbox";
import { startCommand } from "./start";

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  NodeServices.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const program = Command.make("producer-template", {}, () => Effect.void).pipe(
  Command.withSubcommands([startCommand, sandboxCommand]),
);

Command.run(program, { version: packageJson.version }).pipe(
  Effect.provide(EnvLayer),
  Effect.scoped,
  NodeRuntime.runMain,
);
