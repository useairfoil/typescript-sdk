/** biome-ignore-all lint/suspicious/noExplicitAny: Effect schema is invariant. */
import { createServer } from "node:http";
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, Queue } from "effect";
import type { WebhookRoute } from "./types";

export type WebhookServerOptions = {
  readonly port: number;
  readonly routes: ReadonlyArray<WebhookRoute<any>>;
};

const buildRouter = (routes: ReadonlyArray<WebhookRoute<any>>) => {
  let router: HttpRouter.HttpRouter<any, any> = HttpRouter.empty;

  for (const route of routes) {
    router = router.pipe(
      HttpRouter.post(
        route.path,
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const payload = yield* HttpServerRequest.schemaBodyJson(route.schema);
          const actions = yield* route.dispatch(payload, request);

          yield* Effect.forEach(actions, (action) =>
            Queue.offer(action.queue, action.batch),
          );

          return yield* HttpServerResponse.json({ ok: true });
        }).pipe(
          Effect.catchAllCause(() =>
            HttpServerResponse.json(
              { ok: false, error: "Invalid webhook payload" },
              { status: 400 },
            ),
          ),
        ),
      ),
    );
  }

  return router;
};

export const WebhookServerLayer = (options: WebhookServerOptions) => {
  const router = buildRouter(options.routes);
  const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress);
  const serverLayer = NodeHttpServer.layer(() => createServer(), {
    port: options.port,
  });

  return Layer.provide(app, serverLayer);
};
