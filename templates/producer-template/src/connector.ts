import type { HttpClient } from "effect/unstable/http";

import {
  type ConnectorDefinition,
  ConnectorError,
  defineConnector,
  defineEntity,
  type WebhookRoute,
} from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Option } from "effect";

import { TemplateApiClient, TemplateApiClientConfig } from "./api";
import { type Post, PostSchema, type WebhookPayload, WebhookPayloadSchema } from "./schemas";
import {
  dispatchEntityWebhook,
  type EntityStreams,
  makeEntityStreams,
  resolveCursor,
} from "./streams";

export type TemplateConfig = {
  readonly apiBaseUrl: string;
  readonly apiToken: string;
  readonly webhookSecret: Option.Option<string>;
};

export type TemplateConnectorRuntime = {
  readonly connector: ConnectorDefinition;
  readonly routes: ReadonlyArray<WebhookRoute<WebhookPayload>>;
};

export class TemplateConnector extends Context.Service<
  TemplateConnector,
  TemplateConnectorRuntime
>()("@useairfoil/producer-template/TemplateConnector") {}

// Effect Config surface. Callers supply a ConfigProvider (fromEnv, fromUnknown,
// or layered) and this struct is decoded from it at runtime.
export const TemplateConfigConfig = Config.all({
  apiBaseUrl: Config.string("TEMPLATE_API_BASE_URL").pipe(
    Config.withDefault("https://jsonplaceholder.typicode.com"),
  ),
  apiToken: Config.string("TEMPLATE_API_TOKEN").pipe(Config.withDefault("anonymous")),
  webhookSecret: Config.option(Config.string("TEMPLATE_WEBHOOK_SECRET")),
});

// Replace this stub with the real verification for the upstream service (e.g.
// Stripe, Shopify, GitHub HMAC-SHA256 variants). The signature MUST be
// computed against the raw request body, not a re-serialized JSON string.
const verifyWebhookSignature = (_options: {
  readonly rawBody: Uint8Array;
  readonly signature: string | null;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  // Template intentionally accepts everything. When you port this to a real
  // service, compare the header against the HMAC of `rawBody` using the
  // shared secret and fail with a ConnectorError on mismatch.
  Effect.void;

const resolveWebhookDispatch = (options: {
  readonly payload: WebhookPayload;
  readonly posts: EntityStreams<Post>;
}) => {
  const { payload } = options;
  switch (payload.type) {
    case "post.created":
    case "post.updated": {
      return Effect.logInfo(`webhook ${payload.type}`).pipe(
        Effect.annotateLogs({ id: payload.data.id }),
        Effect.andThen(
          resolveCursor(payload.data, "id").pipe(
            Effect.flatMap((cursor) =>
              dispatchEntityWebhook({
                queue: options.posts.live,
                cutoff: options.posts.cutoff,
                row: payload.data,
                cursor,
              }),
            ),
          ),
        ),
      );
    }
    case "post.deleted": {
      return Effect.void;
    }
    default: {
      return Effect.logWarning("Ignoring unknown webhook type").pipe(
        Effect.annotateLogs({ type: (payload as { type: string }).type }),
        Effect.asVoid,
      );
    }
  }
};

const makeTemplateConnector = (
  config: TemplateConfig,
): Effect.Effect<TemplateConnectorRuntime, ConnectorError, TemplateApiClient> =>
  Effect.gen(function* () {
    const api = yield* TemplateApiClient;
    const postStreams = yield* makeEntityStreams<Post>({
      api,
      schema: PostSchema,
      path: "/posts",
      cursorField: "id",
      limit: 10,
    });

    const connector = defineConnector({
      name: "producer-template",
      entities: [
        defineEntity({
          name: "posts",
          schema: PostSchema,
          primaryKey: "id",
          live: postStreams.live,
          backfill: postStreams.backfill,
        }),
      ],
      events: [],
    });

    const webhookRoute: WebhookRoute<WebhookPayload> = {
      path: "/webhooks/template",
      schema: WebhookPayloadSchema,
      handle: (payload, request, rawBody) =>
        Effect.gen(function* () {
          if (Option.isSome(config.webhookSecret) && rawBody) {
            yield* verifyWebhookSignature({
              rawBody,
              signature: request.headers["x-template-signature"] ?? null,
              secret: config.webhookSecret.value,
            });
          }

          yield* resolveWebhookDispatch({
            payload,
            posts: postStreams,
          });
        }),
    };

    if (Option.isNone(config.webhookSecret)) {
      yield* Effect.logWarning(
        "TEMPLATE_WEBHOOK_SECRET is not set. Incoming webhooks will not be signature-verified.",
      );
    }

    return { connector, routes: [webhookRoute] };
  }).pipe(Effect.annotateLogs({ component: "producer-template" }));

export const TemplateConnectorConfig = (): Layer.Layer<
  TemplateConnector,
  ConnectorError,
  HttpClient.HttpClient
> =>
  Layer.effect(TemplateConnector)(
    Effect.gen(function* () {
      const config = yield* TemplateConfigConfig;
      return yield* makeTemplateConnector(config).pipe(
        Effect.provide(TemplateApiClientConfig(config)),
      );
    }).pipe(
      Effect.mapError((error) =>
        error instanceof ConnectorError
          ? error
          : new ConnectorError({
              message: "Template config failed",
              cause: error,
            }),
      ),
    ),
  );
