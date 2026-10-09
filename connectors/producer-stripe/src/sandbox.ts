import {
  ConnectorApp,
  Ingestor,
  RuntimeConfig,
  StateStore,
  Telemetry,
} from "@useairfoil/connector-kit";
import { Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { StripeConnector } from "./index";

const ConnectorLayer = StripeConnector.layerConfig(StripeConnector.StripeConfigDef.config);

const TelemetryLayer = Layer.mergeAll(Telemetry.layerOtlp(), Telemetry.layerMetricsConsoleDump());

export const sandboxCommand = Command.make("sandbox", {}, () =>
  Effect.gen(function* () {
    const port = yield* RuntimeConfig.httpPort;
    const entrypoint = yield* StripeConnector.StripeConnector;

    return yield* ConnectorApp.start(entrypoint, { port });
  }).pipe(
    Effect.annotateLogs({ component: "stripe" }),
    Effect.provide(
      Layer.mergeAll(
        StateStore.layerMemory,
        Ingestor.layerConsole,
        ConnectorLayer,
        Logger.layer([Logger.consolePretty()]),
        TelemetryLayer,
      ),
    ),
  ),
).pipe(Command.withDescription("Run the connector locally and log ingested data"));
