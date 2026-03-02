import { FetchHttpClient, HttpServer } from "@effect/platform";
import { BunHttpServer } from "@effect/platform-bun";
import {
  buildWebhookRouter,
  Publisher,
  runConnector,
  StateStoreInMemory,
} from "@useairfoil/connector-kit";
import { Config, ConfigProvider, Effect, Layer, Logger } from "effect";
import { PolarConnector, PolarConnectorConfig } from "./index";

const SandboxConfig = Config.all({
  port: Config.port("POLAR_WEBHOOK_PORT").pipe(Config.withDefault(8080)),
});

const ConsolePublisherLayer = Layer.succeed(Publisher, {
  publish: ({ name, batch }) =>
    Effect.gen(function* () {
      const ids = batch.rows.map((r) => r["id"]).filter(Boolean);
      yield* Effect.logInfo(`[polar] publish ${name}`).pipe(
        Effect.annotateLogs({
          count: batch.rows.length,
          ids,
          cursor: batch.cursor,
        }),
      );
      return { success: true };
    }),
});

const program = Effect.gen(function* () {
  const config = yield* SandboxConfig;
  const { connector, routes } = yield* PolarConnector;
  const routePaths = routes.map((route) => route.path);
  const router = buildWebhookRouter(routes);
  const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress);
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
}).pipe(
  Effect.provide(StateStoreInMemory),
  Effect.provide(ConsolePublisherLayer),
  Effect.provide(PolarConnectorConfig()),
  Effect.provide(FetchHttpClient.layer),
  Effect.withConfigProvider(ConfigProvider.fromEnv()),
  Effect.provide(Logger.pretty),
);

Effect.runPromise(program).catch((error) => {
  void Effect.runPromise(
    Effect.logError("[polar] fatal error").pipe(
      Effect.annotateLogs({ error: String(error) }),
    ),
  );
  process.exit(1);
});
