import { ConnectorApp, Publisher, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { TemplateRuntimeKey } from "./constants";
import { TemplateConnector } from "./index";

const HttpServerConfig = Config.all({
  port: Config.port(TemplateRuntimeKey.webhookPort).pipe(Config.withDefault(8080)),
});

const ConnectorLayer = TemplateConnector.layerConfig(TemplateConnector.TemplateConfigDef.config);

const TelemetryLayer = Layer.mergeAll(Telemetry.layerOtlp(), Telemetry.layerMetricsConsoleDump());

export const sandboxCommand = Command.make("sandbox", {}, () =>
  Effect.gen(function* () {
    const config = yield* HttpServerConfig;
    const entrypoint = yield* TemplateConnector.TemplateConnector;

    return yield* ConnectorApp.start(entrypoint, { port: config.port });
  }).pipe(
    Effect.annotateLogs({ component: "producer-template" }),
    Effect.provide(
      Layer.mergeAll(
        StateStore.layerMemory,
        Publisher.layerConsole,
        ConnectorLayer,
        Logger.layer([Logger.consolePretty()]),
        TelemetryLayer,
      ),
    ),
  ),
).pipe(Command.withDescription("Run the connector locally and log ingested data"));
