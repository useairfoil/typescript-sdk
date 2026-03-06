import { BunHttpServer } from "@effect/platform-bun";
import type { ConnectorError } from "@useairfoil/connector-kit";
import {
  buildWebhookRouter,
  Publisher,
  runConnector,
  StateStoreInMemory,
} from "@useairfoil/connector-kit";
import { Config, ConfigProvider, Effect, Layer, Logger } from "effect";
import {
  FetchHttpClient,
  HttpRouter,
  HttpServerResponse,
} from "effect/unstable/http";
import { PolarConnector, PolarConnectorConfig } from "./index";

const SandboxConfig = Config.all({
  port: Config.port("POLAR_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const ConsolePublisherLayer = Layer.succeed(Publisher)({
  publish: ({ name, batch }) =>
    Effect.gen(function* () {
      const ids = batch.rows.map((r) => r["id"]).filter(Boolean);
      const source = typeof batch.cursor === "number" ? "backfill" : "live";
      yield* Effect.logInfo(
        `[publisher] -> Source: ${source} | Name: ${name}`,
      ).pipe(
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
  const routerLayer = Layer.mergeAll(
    buildWebhookRouter(routes),
    HttpRouter.add(
      "GET",
      "/health",
      Effect.succeed(HttpServerResponse.text("ok")),
    ),
  );
  const app = HttpRouter.serve(routerLayer, {
    disableLogger: true,
  });
  const serverLayer = Layer.provide(
    app,
    BunHttpServer.layer({ port: config.port }),
  );

  yield* Effect.logInfo("[polar] webhook server ready").pipe(
    Effect.annotateLogs({ port: config.port, routes: routePaths }),
  );

  return yield* runConnector(connector, new Date()).pipe(
    Effect.provide(serverLayer),
  );
});

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const ConnectorLayer = PolarConnectorConfig().pipe(
  Layer.provideMerge(EnvLayer),
);

const RuntimeLayer = Layer.mergeAll(
  StateStoreInMemory,
  ConsolePublisherLayer,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  EnvLayer,
);

Effect.runPromise(
  Effect.scoped(program).pipe(Effect.provide(RuntimeLayer)) as Effect.Effect<
    void,
    Config.ConfigError | ConnectorError
  >,
).catch((error) => {
  void Effect.runPromise(
    Effect.logError("[polar] fatal error").pipe(
      Effect.annotateLogs({ error: String(error) }),
    ),
  );
  process.exit(1);
});
