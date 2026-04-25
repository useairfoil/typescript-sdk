import type { ConnectorError } from "@useairfoil/connector-kit";

import { NodeHttpServer } from "@effect/platform-node";
import { Publisher, runConnector, StateStoreInMemory } from "@useairfoil/connector-kit";
import { Config, ConfigProvider, DateTime, Effect, Layer, Logger, Metric } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as Observability from "effect/unstable/observability";
import { createServer } from "node:http";

import { PolarConnector, PolarConnectorConfig } from "./index";

const SandboxConfig = Config.all({
  port: Config.port("POLAR_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const TelemetryConfig = Config.all({
  enabled: Config.boolean("ACK_TELEMETRY_ENABLED").pipe(Config.withDefault(false)),
  baseUrl: Config.string("ACK_OTLP_BASE_URL").pipe(Config.withDefault("http://localhost:4318")),
  serviceName: Config.string("ACK_SERVICE_NAME").pipe(Config.withDefault("producer-polar")),
});

const ConsolePublisherLayer = Layer.succeed(Publisher)({
  publish: ({ name, source, batch }) =>
    Effect.gen(function* () {
      const ids = batch.rows.map((r) => r["id"]).filter(Boolean);
      yield* Effect.logInfo(`[publisher] -> Source: ${source} | Name: ${name}`).pipe(
        Effect.annotateLogs({
          count: batch.rows.length,
          ids,
          cursor: batch.cursor,
          source,
        }),
      );
      return { success: true };
    }),
});

const program = Effect.gen(function* () {
  const config = yield* SandboxConfig;
  const { connector, routes } = yield* PolarConnector;
  const routePaths = routes.map((route) => route.path);
  const serverLayer = NodeHttpServer.layer(createServer, { port: config.port });

  yield* Effect.logInfo("webhook server ready").pipe(
    Effect.annotateLogs({ port: config.port, routes: routePaths }),
  );

  const now = yield* DateTime.now;

  return yield* runConnector(connector, {
    initialCutoff: DateTime.toDate(now),
    webhook: {
      routes,
      healthPath: "/health",
      disableHttpLogger: true,
    },
  }).pipe(Effect.provide(serverLayer));
}).pipe(Effect.annotateLogs({ component: "polar" }));

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const ConnectorLayer = PolarConnectorConfig();

const TelemetryLayer = Layer.unwrap(
  Effect.gen(function* () {
    const telemetry = yield* TelemetryConfig;
    if (!telemetry.enabled) {
      return Layer.empty;
    }

    yield* Effect.logInfo("telemetry enabled").pipe(
      Effect.annotateLogs({
        serviceName: telemetry.serviceName,
        baseUrl: telemetry.baseUrl,
      }),
    );

    return Layer.mergeAll(
      Observability.Otlp.layerJson({
        baseUrl: telemetry.baseUrl,
        resource: {
          serviceName: telemetry.serviceName,
        },
      }),
      Metric.enableRuntimeMetricsLayer,
    );
  }),
);

const RuntimeLayer = Layer.mergeAll(
  StateStoreInMemory,
  ConsolePublisherLayer,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
  EnvLayer,
);

Effect.runPromise(
  Effect.scoped(program).pipe(Effect.provide(RuntimeLayer)) as Effect.Effect<
    void,
    Config.ConfigError | ConnectorError
  >,
).catch((error) => {
  void Effect.runPromise(
    Effect.logError("fatal error").pipe(
      Effect.annotateLogs({ component: "polar", error: String(error) }),
    ),
  );
  process.exit(1);
});
