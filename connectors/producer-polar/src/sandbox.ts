import { HttpServer } from "@effect/platform";
import { BunHttpServer } from "@effect/platform-bun";
import {
  buildWebhookRouter,
  Publisher,
  runConnector,
  StateStoreInMemory,
} from "@useairfoil/connector-kit";
import { Effect, Layer } from "effect";
import { makePolarConnector } from "./index";

const accessToken = process.env.POLAR_ACCESS_TOKEN;
const organizationId = process.env.POLAR_ORGANIZATION_ID;
const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
const port = Number(process.env.POLAR_WEBHOOK_PORT ?? "8080");

if (!accessToken) {
  throw new Error("Missing POLAR_ACCESS_TOKEN");
}

const ConsolePublisherLayer = Layer.succeed(Publisher, {
  publish: ({ name, batch }) =>
    Effect.sync(() => {
      const ids = batch.rows.map((r) => r["id"]).filter(Boolean);
      console.log(`[polar] publish ${name}`, {
        count: batch.rows.length,
        ids,
        cursor: batch.cursor,
      });
      return { success: true };
    }),
});

const program = makePolarConnector({
  accessToken,
  organizationId,
  webhookSecret,
}).pipe(
  Effect.flatMap(({ connector, routes }) => {
    const routePaths = routes.map((route) => route.path);
    const router = buildWebhookRouter(routes);
    const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress);
    const serverLayer = Layer.provide(app, BunHttpServer.layer({ port }));

    return Effect.sync(() => {
      console.log("[polar] webhook server ready", {
        port,
        routes: routePaths,
      });
    }).pipe(
      Effect.andThen(runConnector(connector, new Date())),
      Effect.provide(serverLayer),
    );
  }),
  Effect.provide(StateStoreInMemory),
  Effect.provide(ConsolePublisherLayer),
);

Effect.runPromise(program).catch((error) => {
  console.error("[polar] fatal error", error);
  process.exit(1);
});
