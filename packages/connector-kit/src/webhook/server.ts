import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import { Effect, Schema } from "effect";
import type { WebhookRoute } from "./types";

const makeHandler = <TPayload>(route: WebhookRoute<TPayload>) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const rawBuffer = yield* request.arrayBuffer.pipe(
      Effect.catchAll(() =>
        Effect.fail(new Error("Failed to read request body")),
      ),
    );
    const rawBody = new Uint8Array(rawBuffer);
    const rawText = new TextDecoder().decode(rawBody);
    const rawJson = yield* Effect.try({
      try: () => JSON.parse(rawText) as unknown,
      catch: () => new Error("Invalid JSON body"),
    });
    const payload = yield* Schema.decodeUnknown(route.schema)(rawJson);
    yield* route.handle(payload, request, rawBody);
    // unsafeJson serializes synchronously — no Effect, no HttpBodyError
    return HttpServerResponse.unsafeJson({ ok: true });
  }).pipe(
    Effect.catchAllCause(() =>
      Effect.succeed(
        HttpServerResponse.unsafeJson(
          { ok: false, error: "Invalid webhook payload" },
          { status: 400 },
        ),
      ),
    ),
  );

export const buildWebhookRouter = <TPayload>(
  routes: ReadonlyArray<WebhookRoute<TPayload>>,
) =>
  routes.reduce(
    (router, route) =>
      router.pipe(HttpRouter.post(route.path, makeHandler(route))),
    HttpRouter.empty,
  );
