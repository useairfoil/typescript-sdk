import type { ConnectorError } from "@useairfoil/connector-kit";

import { NodeHttpServer } from "@effect/platform-node";
import { Ingestion, Publisher } from "@useairfoil/connector-kit";
import { Config, ConfigProvider, DateTime, Effect, Layer, Logger, Option } from "effect";
import { FetchHttpClient, Headers } from "effect/unstable/http";
import * as Observability from "effect/unstable/observability";
import { createServer } from "node:http";

import { ShopifyConnector } from "./index";

const SandboxConfig = Config.all({
  port: Config.port("SHOPIFY_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const TelemetryConfig = Config.all({
  enabled: Config.boolean("OTEL_ENABLED").pipe(Config.withDefault(false)),
  baseUrl: Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")),
  headers: Config.option(Config.string("OTEL_EXPORTER_OTLP_HEADERS")),
});

const parseOtelHeaders = (value: string): Record<string, string> =>
  Object.fromEntries(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry) => {
        const separator = entry.indexOf("=");
        if (separator < 1) return [];
        return [[entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]];
      }),
  );

const appendPath = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

const SensitiveHeaderRedactionLayer = Layer.succeed(Headers.CurrentRedactedNames)([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  /api[-_]?key/i,
  /secret/i,
  /signature/i,
  /token/i,
]);

// Console publisher so you can see ingestion output during `pnpm run sandbox`.
// Real connectors plug in `layerWings` from @useairfoil/connector-kit.
const ConsolePublisherLayer = Layer.succeed(Publisher.Publisher)({
  publish: ({ name, source, batch }) =>
    Effect.gen(function* () {
      const ids = batch.rows.map((r) => r["id"]).filter((id) => id != null);
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
  const { connector, routes } = yield* ShopifyConnector.ShopifyConnector;
  const routePaths = routes.map((route) => route.path);
  const serverLayer = NodeHttpServer.layer(createServer, { port: config.port });

  yield* Effect.logInfo("webhook server ready").pipe(
    Effect.annotateLogs({ port: config.port, routes: routePaths }),
  );

  const now = yield* DateTime.now;

  return yield* Ingestion.runConnector(connector, {
    initialCutoff: now,
    webhook: {
      routes,
      healthPath: "/health",
      disableHttpLogger: true,
    },
  }).pipe(Effect.provide(serverLayer));
}).pipe(Effect.annotateLogs({ component: "producer-shopify" }));

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const ConnectorLayer: Layer.Layer<
  ShopifyConnector.ShopifyConnector,
  Config.ConfigError | ConnectorError
> = ShopifyConnector.layerConfig(ShopifyConnector.ShopifyConfigConfig).pipe(
  Layer.provide(EnvLayer),
);

const TelemetryLayer = Layer.unwrap(
  Effect.gen(function* () {
    const telemetry = yield* TelemetryConfig;
    if (!telemetry.enabled) {
      return Layer.empty;
    }

    if (Option.isNone(telemetry.baseUrl)) {
      return yield* Effect.fail(
        new Error("OTEL_ENABLED=true requires OTEL_EXPORTER_OTLP_ENDPOINT"),
      );
    }

    const headers = Option.isSome(telemetry.headers)
      ? parseOtelHeaders(telemetry.headers.value)
      : undefined;

    yield* Effect.logInfo("telemetry enabled").pipe(
      Effect.annotateLogs({
        baseUrl: telemetry.baseUrl.value,
        headers: headers ? Object.keys(headers) : [],
      }),
    );

    // OTEL_SERVICE_NAME, OTEL_SERVICE_VERSION, and OTEL_RESOURCE_ATTRIBUTES are read from env automatically by OtlpResource.
    return Observability.OtlpTracer.layer({
      url: appendPath(telemetry.baseUrl.value, "/v1/traces"),
      headers,
    }).pipe(Layer.provide(Observability.OtlpSerialization.layerJson));
  }),
).pipe(Layer.provide(EnvLayer));

const RuntimeLayer = Layer.mergeAll(
  Ingestion.layerMemory,
  ConsolePublisherLayer,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  SensitiveHeaderRedactionLayer,
  TelemetryLayer,
);

Effect.runPromise(Effect.scoped(program).pipe(Effect.provide(RuntimeLayer))).catch((error) => {
  void Effect.runPromise(
    Effect.logError("fatal error").pipe(
      Effect.annotateLogs({
        component: "producer-shopify",
        error: String(error),
      }),
    ),
  );
  process.exit(1);
});
