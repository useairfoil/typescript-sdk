import { ConnectorApp, Publisher, Telemetry } from "@useairfoil/connector-kit";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";
import { KeyValueStore } from "effect/unstable/persistence";

import { ShopifyConnector } from "./index";

const RuntimeConfig = Config.all({
  port: Config.port("SHOPIFY_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const ConnectorLayer = ShopifyConnector.layerConfig(ShopifyConnector.ShopifyConfigDef.config);

const TelemetryLayer = Layer.mergeAll(
  Telemetry.layerOtlp({ redactedHeaders: ["x-shopify-access-token"] }),
  Telemetry.layerMetricsConsoleDump(),
);

export const sandboxCommand = Command.make("sandbox", {}, () =>
  Effect.gen(function* () {
    const config = yield* RuntimeConfig;
    const entrypoint = yield* ShopifyConnector.ShopifyConnector;

    return yield* ConnectorApp.start(entrypoint, {
      port: config.port,
      healthPath: "/health",
    });
  }).pipe(
    Effect.annotateLogs({ component: "producer-shopify" }),
    Effect.provide(
      Layer.mergeAll(
        KeyValueStore.layerMemory,
        Publisher.layerConsole,
        ConnectorLayer,
        Logger.layer([Logger.consolePretty()]),
        TelemetryLayer,
      ),
    ),
  ),
).pipe(Command.withDescription("Run the connector locally and log ingested data"));
