import { ConnectorApp, Publisher, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { PolarConnector } from "./index";

const RuntimeConfig = Config.all({
  port: Config.port("POLAR_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const SandboxConfig = Config.unwrap<PolarConnector.PolarConfig>({
  ...PolarConnector.PolarConfigFields,
  apiBaseUrl: Config.succeed("https://sandbox-api.polar.sh/v1/"),
});

const SandboxConnectorLayer = PolarConnector.layerConfig(SandboxConfig);
const TelemetryLayer = Telemetry.layerOtlpTracing();

export const sandboxCommand = Command.make("sandbox", {}, () =>
  Effect.gen(function* () {
    const config = yield* RuntimeConfig;
    const entrypoint = yield* PolarConnector.PolarConnector;

    return yield* ConnectorApp.start(entrypoint, {
      port: config.port,
      healthPath: "/health",
    });
  }).pipe(
    Effect.annotateLogs({ component: "polar" }),
    Effect.provide(
      Layer.mergeAll(
        StateStore.layerMemory,
        Publisher.layerConsole,
        SandboxConnectorLayer,
        Logger.layer([Logger.consolePretty()]),
        TelemetryLayer,
      ),
    ),
  ),
).pipe(Command.withDescription("Run the connector locally and log ingested data"));
