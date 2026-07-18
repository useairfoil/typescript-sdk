import { PgClient } from "@effect/sql-pg";
import {
  ConnectorApp,
  Publisher,
  RuntimeConfig,
  StateStore,
  Telemetry,
} from "@useairfoil/connector-kit";
import { WingsClient } from "@useairfoil/wings";
import { Config, Effect, Layer, Logger, Schema } from "effect";
import { Command } from "effect/unstable/cli";

import { PolarRuntimeKey } from "./constants";
import { PolarConnector } from "./index";

// The operator injects runtime wiring; these values are intentionally absent
// from the user-facing connector manifest.
const HttpServerConfig = Config.all({
  port: Config.port(PolarRuntimeKey.webhookPort).pipe(Config.withDefault(8080)),
});

const PolarTablesConfig = Config.all({
  customers: Config.nonEmptyString(PolarRuntimeKey.customersTable),
  checkouts: Config.nonEmptyString(PolarRuntimeKey.checkoutsTable),
  orders: Config.nonEmptyString(PolarRuntimeKey.ordersTable),
  subscriptions: Config.nonEmptyString(PolarRuntimeKey.subscriptionsTable),
});

const WingsConfig = Config.all({
  host: Config.nonEmptyString(RuntimeConfig.PlatformRuntimeKey.wingsHost),
  namespace: Config.nonEmptyString(RuntimeConfig.PlatformRuntimeKey.wingsNamespace),
});

const ConnectorLayer = PolarConnector.layerConfig(PolarConnector.PolarConfigDef.config);
const TelemetryLayer = Telemetry.layerOtlp();
const PostgresLayer = PgClient.layerConfig({
  url: Config.schema(
    Schema.Redacted(Schema.NonEmptyString),
    RuntimeConfig.PlatformRuntimeKey.postgresConnectionString,
  ),
  maxConnections: Config.succeed(2),
  connectTimeout: Config.succeed("5 seconds"),
  applicationName: Config.succeed("airfoil-producer-polar"),
});
const StateStoreLayer = StateStore.layerSql().pipe(Layer.provide(PostgresLayer));

export const startCommand = Command.make("start", {}, () =>
  Effect.gen(function* () {
    const runtimeConfig = yield* HttpServerConfig;
    const tableConfig = yield* PolarTablesConfig;
    const entrypoint = yield* PolarConnector.PolarConnector;

    return yield* ConnectorApp.start(entrypoint, { port: runtimeConfig.port }).pipe(
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
        StateStoreLayer,
        ConnectorLayer,
        WingsClient.layerConfig(WingsConfig),
        Logger.layer([Logger.consolePretty()]),
        TelemetryLayer,
      ),
    ),
    Effect.provide(RuntimeConfig.layerHosted()),
  ),
).pipe(Command.withDescription("Run the production connector against Wings"));
