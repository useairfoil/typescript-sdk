import { ConnectorApp, Publisher, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { WingsClient } from "@useairfoil/wings";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { ShopifyConnector } from "./index";

const RuntimeConfig = Config.all({
  port: Config.port("SHOPIFY_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const ShopifyTablesConfig = Config.all({
  products: Config.string("SHOPIFY_PRODUCTS_TABLE"),
  cartEvents: Config.string("SHOPIFY_CART_EVENTS_TABLE"),
});

const WingsConfig = Config.all({
  host: Config.string("WINGS_HOST"),
  namespace: Config.string("WINGS_NAMESPACE"),
});

const ConnectorLayer = ShopifyConnector.layerConfig(ShopifyConnector.ShopifyConfigConfig);

const TelemetryLayer = Telemetry.layerOtlpTracing({
  redactedHeaders: ["x-shopify-access-token"],
});

export const startCommand = Command.make("start", {}, () =>
  Effect.gen(function* () {
    const runtimeConfig = yield* RuntimeConfig;
    const tableConfig = yield* ShopifyTablesConfig;
    const entrypoint = yield* ShopifyConnector.ShopifyConnector;

    return yield* ConnectorApp.start(entrypoint, {
      port: runtimeConfig.port,
      healthPath: "/health",
    }).pipe(
      Effect.provide(
        Publisher.layerWings({
          connector: entrypoint.connector,
          tables: {
            products: tableConfig.products,
            cart_events: tableConfig.cartEvents,
          },
        }),
      ),
    );
  }).pipe(
    Effect.annotateLogs({ component: "producer-shopify" }),
    Effect.provide(
      Layer.mergeAll(
        StateStore.layerMemory,
        ConnectorLayer,
        WingsClient.layerConfig(WingsConfig),
        Logger.layer([Logger.consolePretty()]),
        TelemetryLayer,
      ),
    ),
  ),
).pipe(Command.withDescription("Run the production connector against Wings"));
