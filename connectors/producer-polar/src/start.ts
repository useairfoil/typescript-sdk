import { ConnectorApp, Publisher, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { WingsClient } from "@useairfoil/wings";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { PolarConnector } from "./index";

const RuntimeConfig = Config.all({
  port: Config.port("POLAR_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const PolarTablesConfig = Config.all({
  customers: Config.string("POLAR_CUSTOMERS_TABLE"),
  checkouts: Config.string("POLAR_CHECKOUTS_TABLE"),
  orders: Config.string("POLAR_ORDERS_TABLE"),
  subscriptions: Config.string("POLAR_SUBSCRIPTIONS_TABLE"),
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
    const tableConfig = yield* PolarTablesConfig;
    const entrypoint = yield* PolarConnector.PolarConnector;

    return yield* ConnectorApp.start(entrypoint, {
      port: runtimeConfig.port,
      healthPath: "/health",
    }).pipe(
      Effect.provide(
        Publisher.layerWings({
          connector: entrypoint,
          tables: {
            customers: tableConfig.customers,
            checkouts: tableConfig.checkouts,
            orders: tableConfig.orders,
            subscriptions: tableConfig.subscriptions,
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
