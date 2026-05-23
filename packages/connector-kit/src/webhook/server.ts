import { Cause, Data, Effect, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import type { Route } from "./types";

import { Attr, SpanName, annotateError } from "../telemetry";

class InvalidWebhookPayloadError extends Data.TaggedError("InvalidWebhookPayloadError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const decodeRequest = <S extends Schema.Schema<any>>(
  route: Route<S>,
  request: HttpServerRequest.HttpServerRequest,
) =>
  Effect.gen(function* () {
    const rawBuffer = yield* request.arrayBuffer.pipe(
      Effect.mapError(
        () => new InvalidWebhookPayloadError({ message: "Failed to read request body" }),
      ),
    );
    const rawBody = new Uint8Array(rawBuffer);
    const rawText = new TextDecoder().decode(rawBody);
    const rawJson = yield* Effect.try({
      try: () => JSON.parse(rawText) as unknown,
      catch: (cause) => new InvalidWebhookPayloadError({ message: "Invalid JSON body", cause }),
    });
    const payload = yield* Schema.decodeUnknownEffect(route.schema)(rawJson).pipe(
      Effect.mapError(
        (cause) => new InvalidWebhookPayloadError({ message: "Invalid webhook payload", cause }),
      ),
    );
    return { payload, rawBody };
  });

const makeHandler = <S extends Schema.Schema<any>>(route: Route<S>) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;

    const { payload, rawBody } = yield* Effect.withSpan(
      decodeRequest(route, request).pipe(
        Effect.tapError((error) => annotateError("webhook_decode", error)),
      ),
      SpanName.webhookDecode,
      { attributes: { [Attr.webhookPath]: route.path } },
    );

    yield* Effect.withSpan(
      route
        .handle(payload, request, rawBody)
        .pipe(Effect.tapError((error) => annotateError("webhook_handle", error))),
      SpanName.webhookHandle,
      { attributes: { [Attr.webhookPath]: route.path } },
    );

    return HttpServerResponse.jsonUnsafe({ ok: true });
  }).pipe(
    Effect.catchTag("InvalidWebhookPayloadError", (error) =>
      Effect.logWarning("Invalid webhook payload").pipe(
        Effect.annotateLogs({
          message: error.message,
          ...(error.cause !== undefined ? { cause: String(error.cause) } : {}),
        }),
        Effect.andThen(
          Effect.succeed(
            HttpServerResponse.jsonUnsafe({ ok: false, error: error.message }, { status: 400 }),
          ),
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

export const router = (routes: ReadonlyArray<Route>) =>
  HttpRouter.addAll(
    routes.map((route) => HttpRouter.route("POST", route.path, makeHandler(route))),
  );
