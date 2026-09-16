import {
  ConnectorApp,
  Ingestor,
  RuntimeConfig,
  StateStore,
  Telemetry,
} from "@useairfoil/connector-kit";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { PolarConnector } from "./index";

const SandboxConfig = Config.unwrap<PolarConnector.PolarConfig>({
  ...PolarConnector.PolarConfigDef.fields,
  apiBaseUrl: Config.succeed("https://sandbox-api.polar.sh/v1/"),
});

const SandboxConnectorLayer = PolarConnector.layerConfig(SandboxConfig);
const TelemetryLayer = Layer.mergeAll(Telemetry.layerOtlp(), Telemetry.layerMetricsConsoleDump());

export const sandboxCommand = Command.make("sandbox", {}, () =>
  Effect.gen(function* () {
    const port = yield* RuntimeConfig.httpPort;
    const entrypoint = yield* PolarConnector.PolarConnector;

    return yield* ConnectorApp.start(entrypoint, { port });
  }).pipe(
    Effect.annotateLogs({ component: "polar" }),
    Effect.provide(
      Layer.mergeAll(
        StateStore.layerMemory,
        Ingestor.layerConsole,
        SandboxConnectorLayer,
        Logger.layer([Logger.consolePretty()]),
        TelemetryLayer,
      ),
    ),
  ),
).pipe(Command.withDescription("Run the connector locally and log ingested data"));
