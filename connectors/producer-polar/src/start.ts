import { ConnectorApp, Publisher, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { WingsClient } from "@useairfoil/wings";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { PolarConnector } from "./index";

const RuntimeConfig = Config.all({
  port: Config.port("POLAR_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const PolarTopicsConfig = Config.all({
  customers: Config.string("POLAR_CUSTOMERS_TOPIC"),
  checkouts: Config.string("POLAR_CHECKOUTS_TOPIC"),
  orders: Config.string("POLAR_ORDERS_TOPIC"),
  subscriptions: Config.string("POLAR_SUBSCRIPTIONS_TOPIC"),
});

const WingsConfig = Config.all({
  host: Config.string("WINGS_HOST"),
  namespace: Config.string("WINGS_NAMESPACE"),
});

const ConnectorLayer = PolarConnector.layerConfig(PolarConnector.PolarConfigConfig);
const TelemetryLayer = Telemetry.layerOtlpTracing();

export const startCommand = Command.make("start", {}, () =>
  Effect.gen(function* () {
    const runtimeConfig = yield* RuntimeConfig;
    const topicConfig = yield* PolarTopicsConfig;
    const entrypoint = yield* PolarConnector.PolarConnector;

    return yield* ConnectorApp.start(entrypoint, {
      port: runtimeConfig.port,
      healthPath: "/health",
    }).pipe(
      Effect.provide(
        Publisher.layerWings({
          connector: entrypoint.connector,
          topics: {
            customers: topicConfig.customers,
            checkouts: topicConfig.checkouts,
            orders: topicConfig.orders,
            subscriptions: topicConfig.subscriptions,
          },
        }),
      ),
    );
  }).pipe(
    Effect.annotateLogs({ component: "polar" }),
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
