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

import { ShopifyConnector } from "./index";

const ConnectorLayer = ShopifyConnector.layerConfig(ShopifyConnector.ShopifyConfigDef.config);

const TelemetryLayer = Telemetry.layerOtlp({
  redactedHeaders: ["x-shopify-access-token"],
});
const PostgresLayer = PgClient.layerConfig({
  url: Config.schema(
    Schema.Redacted(Schema.NonEmptyString),
    RuntimeConfig.PlatformRuntimeKey.postgresConnectionString,
  ),
  maxConnections: Config.succeed(2),
  connectTimeout: Config.succeed("5 seconds"),
  applicationName: Config.succeed("airfoil-producer-shopify"),
});
const StateStoreLayer = StateStore.layerSql().pipe(Layer.provide(PostgresLayer));

export const startCommand = Command.make("start", {}, () =>
  Effect.gen(function* () {
    const port = yield* RuntimeConfig.httpPort;
    const entrypoint = yield* ShopifyConnector.ShopifyConnector;

    return yield* ConnectorApp.start(entrypoint, { port }).pipe(
      Effect.provide(Publisher.layerWingsConfig(entrypoint)),
    );
  }).pipe(
    Effect.annotateLogs({ component: "producer-shopify" }),
    Effect.provide(
      Layer.mergeAll(
        StateStoreLayer,
        ConnectorLayer,
        WingsClient.layerConfig(RuntimeConfig.wingsClient),
        Logger.layer([Logger.consolePretty()]),
        TelemetryLayer,
      ),
    ),
    Effect.provide(RuntimeConfig.layerHosted()),
  ),
).pipe(Command.withDescription("Run the production connector against Wings"));
