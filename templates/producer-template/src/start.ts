import { ConnectorApp, Publisher, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { WingsClient } from "@useairfoil/wings";
import { Config, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";

import { TemplateConnector } from "./index";

const RuntimeConfig = Config.all({
  port: Config.port("TEMPLATE_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const TemplateTablesConfig = Config.all({
  posts: Config.string("TEMPLATE_POSTS_TABLE"),
});

const WingsConfig = Config.all({
  host: Config.string("WINGS_HOST"),
  namespace: Config.string("WINGS_NAMESPACE"),
});

const ConnectorLayer = TemplateConnector.layerConfig(TemplateConnector.TemplateConfigConfig);

const TelemetryLayer = Telemetry.layerOtlpTracing();

export const startCommand = Command.make("start", {}, () =>
  Effect.gen(function* () {
    const runtimeConfig = yield* RuntimeConfig;
    const tableConfig = yield* TemplateTablesConfig;
    const entrypoint = yield* TemplateConnector.TemplateConnector;

    return yield* ConnectorApp.start(entrypoint, {
      port: runtimeConfig.port,
      healthPath: "/health",
    }).pipe(
      Effect.provide(
        Publisher.layerWings({
          connector: entrypoint.connector,
          tables: { posts: tableConfig.posts },
        }),
      ),
    );
  }).pipe(
    Effect.annotateLogs({ component: "producer-template" }),
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
