import { ConnectorApp, Publisher, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { ShopifyRuntimeKey } from "./constants";
import { ShopifyConnector } from "./index";

const HttpServerConfig = Config.all({
  port: Config.port(ShopifyRuntimeKey.webhookPort).pipe(Config.withDefault(8080)),
});

const ConnectorLayer = ShopifyConnector.layerConfig(ShopifyConnector.ShopifyConfigDef.config);

const TelemetryLayer = Layer.mergeAll(
  Telemetry.layerOtlp({ redactedHeaders: ["x-shopify-access-token"] }),
  Telemetry.layerMetricsConsoleDump(),
);

export const sandboxCommand = Command.make("sandbox", {}, () =>
  Effect.gen(function* () {
    const config = yield* HttpServerConfig;
    const entrypoint = yield* ShopifyConnector.ShopifyConnector;

    return yield* ConnectorApp.start(entrypoint, { port: config.port });
  }).pipe(
    Effect.annotateLogs({ component: "producer-shopify" }),
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
