import { Cause, Data, Effect, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import type { WebhookRoute } from "./types";

class InvalidWebhookPayloadError extends Data.TaggedError("InvalidWebhookPayloadError")<{
  readonly message: string;
}> {}

const makeHandler = Effect.fn("webhook/handler")(
  function* <S extends Schema.Schema<any>>(route: WebhookRoute<S>) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const rawBuffer = yield* request.arrayBuffer.pipe(
      Effect.mapError(
        () =>
          new InvalidWebhookPayloadError({
            message: "Failed to read request body",
          }),
      ),
    );
    const rawBody = new Uint8Array(rawBuffer);
    const rawText = new TextDecoder().decode(rawBody);
    const rawJson = yield* Effect.try({
      try: () => JSON.parse(rawText) as unknown,
      catch: () => new InvalidWebhookPayloadError({ message: "Invalid JSON body" }),
    });
    const payload = yield* Schema.decodeUnknownEffect(route.schema)(rawJson).pipe(
      Effect.mapError(
        () =>
          new InvalidWebhookPayloadError({
            message: "Invalid webhook payload",
          }),
      ),
    );
    yield* route.handle(payload, request, rawBody);
    // jsonUnsafe serializes synchronously — no Effect, no HttpBodyError
    return HttpServerResponse.jsonUnsafe({ ok: true });
  },
  Effect.catchTag("InvalidWebhookPayloadError", () =>
    Effect.succeed(
      HttpServerResponse.jsonUnsafe(
        { ok: false, error: "Invalid webhook payload" },
        { status: 400 },
      ),
    ),
  ),
  Effect.catchCause((cause) =>
    Effect.logWarning(`Webhook handler error: ${Cause.pretty(cause)}`).pipe(
      Effect.andThen(
        Effect.succeed(
          HttpServerResponse.jsonUnsafe(
            { ok: false, error: "Webhook handler failed" },
            { status: 500 },
          ),
        ),
      ),
    ),
  ),
);

export const buildWebhookRouter = (routes: ReadonlyArray<WebhookRoute>) =>
  HttpRouter.addAll(
    routes.map((route) => HttpRouter.route("POST", route.path, makeHandler(route))),
  );
