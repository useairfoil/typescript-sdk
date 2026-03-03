import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import { Cause, Data, Effect, Schema } from "effect";
import type { WebhookRoute } from "./types";

class InvalidWebhookPayloadError extends Data.TaggedError(
  "InvalidWebhookPayloadError",
)<{
  readonly message: string;
}> {}

const makeHandler = <TPayload>(route: WebhookRoute<TPayload>) =>
  Effect.gen(function* () {
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
      catch: () =>
        new InvalidWebhookPayloadError({ message: "Invalid JSON body" }),
    });
    const payload = yield* Schema.decodeUnknown(route.schema)(rawJson).pipe(
      Effect.mapError(
        () =>
          new InvalidWebhookPayloadError({
            message: "Invalid webhook payload",
          }),
      ),
    );
    yield* route.handle(payload, request, rawBody);
    // unsafeJson serializes synchronously — no Effect, no HttpBodyError
    return HttpServerResponse.unsafeJson({ ok: true });
  }).pipe(
    Effect.catchTag("InvalidWebhookPayloadError", () =>
      Effect.succeed(
        HttpServerResponse.unsafeJson(
          { ok: false, error: "Invalid webhook payload" },
          { status: 400 },
        ),
      ),
    ),
    Effect.catchAllCause((cause) =>
      Effect.logWarning(`Webhook handler error: ${Cause.pretty(cause)}`).pipe(
        Effect.zipRight(
          Effect.succeed(
            HttpServerResponse.unsafeJson(
              { ok: false, error: "Webhook handler failed" },
              { status: 500 },
            ),
          ),
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
