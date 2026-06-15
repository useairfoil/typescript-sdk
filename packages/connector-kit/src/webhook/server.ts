import { Cause, Context, Effect, Queue, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import type {
  ResourceBatch,
  ResourceDefinition,
  ResourceMutation,
  WebhookHandler,
  WebhookRoute,
} from "../core/types";

import { ConnectorError } from "../errors";
import { Publisher } from "../publisher/service";
import { Attr, SpanName, annotateError } from "../telemetry";

export type QueuedWebhookBatch = {
  readonly resource: string;
  readonly batch: ResourceBatch;
};

export class WebhookQueue extends Context.Service<
  WebhookQueue,
  {
    readonly queue: Queue.Queue<QueuedWebhookBatch>;
  }
>()("@useairfoil/connector-kit/WebhookQueue") {}

const resourceBatch = <Row extends object>(
  mutations: ReadonlyArray<ResourceMutation<Row>>,
): ResourceBatch<Row> => ({
  mutations,
});

const decodeAndHandleWebhook = <Row extends object, Payload>(
  resourceName: string,
  webhook: WebhookHandler<Row, Payload>,
  payload: unknown,
) =>
  Schema.decodeUnknownEffect(webhook.schema)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new ConnectorError({
          message: `Invalid webhook payload for resource ${resourceName}`,
          cause,
        }),
    ),
    Effect.flatMap((decoded) => webhook.handler({ payload: decoded })),
  );

const makeRouteContext = (
  request: HttpServerRequest.HttpServerRequest,
  rawBody: Uint8Array,
  payload: unknown,
  batches: Array<QueuedWebhookBatch>,
): import("../core/types").WebhookRouteContext<ReadonlyArray<ResourceDefinition>, unknown> => ({
  request,
  rawBody,
  payload,
  to: (resource, payload) =>
    Effect.gen(function* () {
      if (!resource.webhook) {
        return yield* Effect.fail(
          new ConnectorError({
            message: `Resource ${resource.name} does not define a webhook handler`,
          }),
        );
      }

      const mutations = yield* decodeAndHandleWebhook(resource.name, resource.webhook, payload);
      batches.push({
        resource: resource.name,
        batch: resourceBatch(mutations),
      });
    }),
});

const compactBatches = (batches: ReadonlyArray<QueuedWebhookBatch>) => {
  const grouped = new Map<string, ResourceMutation[]>();
  for (const item of batches) {
    const current = grouped.get(item.resource) ?? [];
    grouped.set(item.resource, [...current, ...item.batch.mutations]);
  }
  return Array.from(grouped.entries()).map(([resource, mutations]) => ({
    resource,
    batch: resourceBatch(mutations),
  }));
};

const publishBatches = (batches: ReadonlyArray<QueuedWebhookBatch>) =>
  Effect.gen(function* () {
    const publisher = yield* Publisher;
    yield* Effect.forEach(
      batches,
      (batch) =>
        Effect.gen(function* () {
          const ack = yield* publisher.publish({
            resource: batch.resource,
            source: "webhook",
            batch: batch.batch,
          });
          if (ack.status === "rejected") {
            return yield* Effect.fail(new ConnectorError({ message: ack.reason }));
          }
        }),
      { concurrency: "unbounded" },
    );
  });

const badRequest = (message: string) =>
  HttpServerResponse.jsonUnsafe({ ok: false, error: message }, { status: 400 });

const readRawBody = (request: HttpServerRequest.HttpServerRequest) =>
  request.arrayBuffer.pipe(Effect.map((buffer) => new Uint8Array(buffer)));

const parseJson = (rawBody: Uint8Array) =>
  Effect.try({
    try: () => JSON.parse(new TextDecoder().decode(rawBody)) as unknown,
    catch: (cause) => new ConnectorError({ message: "Invalid webhook JSON", cause }),
  });

const makeHandler = (route: WebhookRoute) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const collected: Array<QueuedWebhookBatch> = [];

    const rawBodyResult = yield* readRawBody(request).pipe(
      Effect.match({
        onFailure: () => ({ _tag: "Error" as const, message: "Failed to read webhook body" }),
        onSuccess: (value) => ({ _tag: "Success" as const, value }),
      }),
    );
    if (rawBodyResult._tag === "Error") {
      return badRequest(rawBodyResult.message);
    }

    const jsonResult = yield* parseJson(rawBodyResult.value).pipe(
      Effect.match({
        onFailure: (error) => ({ _tag: "Error" as const, message: error.message }),
        onSuccess: (value) => ({ _tag: "Success" as const, value }),
      }),
    );
    if (jsonResult._tag === "Error") {
      return badRequest(jsonResult.message);
    }

    const payloadResult = yield* Schema.decodeUnknownEffect(route.schema)(jsonResult.value).pipe(
      Effect.match({
        onFailure: () => ({ _tag: "Error" as const, message: "Invalid webhook payload" }),
        onSuccess: (value) => ({ _tag: "Success" as const, value }),
      }),
    );
    if (payloadResult._tag === "Error") {
      return badRequest(payloadResult.message);
    }

    const response = yield* Effect.withSpan(
      route
        .handler(makeRouteContext(request, rawBodyResult.value, payloadResult.value, collected))
        .pipe(Effect.tapError((error) => annotateError("webhook_handle", error))),
      SpanName.webhookHandle,
      { attributes: { [Attr.webhookPath]: route.path } },
    );

    const batches = compactBatches(collected);

    if (route.ackMode === "after-enqueue") {
      const queue = yield* WebhookQueue;
      yield* Queue.offerAll(queue.queue, batches);
      return response;
    }

    yield* Effect.withSpan(
      publishBatches(batches).pipe(
        Effect.tapError((error) => annotateError("webhook_publish", error)),
      ),
      SpanName.webhookHandle,
      { attributes: { [Attr.webhookPath]: route.path } },
    );

    return response;
  }).pipe(
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

export const router = (routes: ReadonlyArray<WebhookRoute>) =>
  HttpRouter.addAll(
    routes.map((route) => HttpRouter.route("POST", route.path, makeHandler(route))),
  );
