import type { HttpClient } from "effect/unstable/http";

import {
  type ConnectorDefinition,
  ConnectorError,
  defineConnector,
  defineEntity,
  Webhook,
} from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Option } from "effect";
import { createHmac, timingSafeEqual } from "node:crypto";

import { layerApiClient, ShopifyApiClient } from "./api";
import { type Product, ProductSchema, type WebhookPayload, WebhookPayloadSchema } from "./schemas";
import {
  dispatchEntityWebhook,
  type EntityStreams,
  makeEntityStreams,
  resolveCursor,
} from "./streams";

export type ShopifyConfig = {
  readonly apiBaseUrl: string;
  readonly apiToken: string;
  readonly webhookSecret: Option.Option<string>;
};

export type ShopifyConnectorRuntime = {
  readonly connector: ConnectorDefinition;
  readonly routes: ReadonlyArray<Webhook.WebhookRoute<typeof WebhookPayloadSchema>>;
};

export class ShopifyConnector extends Context.Service<ShopifyConnector, ShopifyConnectorRuntime>()(
  "@useairfoil/producer-shopify/ShopifyConnector",
) {}

export const ShopifyConfigConfig = Config.all({
  apiBaseUrl: Config.string("SHOPIFY_API_BASE_URL").pipe(
    Config.withDefault("https://your-development-store.myshopify.com/admin/api/2026-01"),
  ),
  apiToken: Config.string("SHOPIFY_API_TOKEN"),
  webhookSecret: Config.option(Config.string("SHOPIFY_WEBHOOK_SECRET")),
});

const verifyWebhookSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly signature: string | null;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      if (!options.signature) {
        throw new Error("Missing x-shopify-hmac-sha256 header");
      }
      const digest = createHmac("sha256", options.secret)
        .update(Buffer.from(options.rawBody))
        .digest();
      const provided = Buffer.from(options.signature, "base64");
      if (provided.length !== digest.length || !timingSafeEqual(digest, provided)) {
        throw new Error("Invalid Shopify webhook signature");
      }
    },
    catch: (cause) =>
      new ConnectorError({
        message: "Shopify webhook verification failed",
        cause,
      }),
  });

const resolveWebhookDispatch = (options: {
  readonly payload: WebhookPayload;
  readonly topic: string;
  readonly products: EntityStreams<Product>;
}) => {
  switch (options.topic) {
    case "products/create":
    case "products/update": {
      return Effect.logInfo(`webhook ${options.topic}`).pipe(
        Effect.annotateLogs({ id: options.payload.id }),
        Effect.andThen(
          resolveCursor(options.payload, "updated_at").pipe(
            Effect.flatMap((cursor) =>
              dispatchEntityWebhook({
                queue: options.products.live,
                cutoff: options.products.cutoff,
                row: options.payload,
                cursor,
              }),
            ),
          ),
        ),
      );
    }
    default: {
      return Effect.logWarning("Ignoring unknown Shopify webhook topic").pipe(
        Effect.annotateLogs({ topic: options.topic }),
        Effect.asVoid,
      );
    }
  }
};

const makeShopifyConnector = Effect.fnUntraced(function* (
  config: ShopifyConfig,
): Effect.fn.Return<ShopifyConnectorRuntime, ConnectorError, ShopifyApiClient> {
  const api = yield* ShopifyApiClient;
  const productStreams = yield* makeEntityStreams<Product>({
    api,
    schema: ProductSchema,
    path: "/products.json",
    cursorField: "updated_at",
    limit: 50,
  });

  const connector = defineConnector({
    name: "producer-shopify",
    entities: [
      defineEntity({
        name: "products",
        schema: ProductSchema,
        primaryKey: "id",
        live: productStreams.live,
        backfill: productStreams.backfill,
      }),
    ],
    events: [],
  });

  const webhookRoute = Webhook.route({
    path: "/webhooks/shopify",
    schema: WebhookPayloadSchema,
    handle: (payload, request, rawBody) =>
      Effect.withSpan(
        Effect.gen(function* () {
          const topic = request.headers["x-shopify-topic"] ?? "";

          if (Option.isSome(config.webhookSecret)) {
            const verifiedBody = rawBody;
            if (!verifiedBody) {
              return yield* Effect.fail(
                new ConnectorError({
                  message: "Webhook raw body is required for Shopify signature verification",
                }),
              );
            }
            yield* verifyWebhookSignature({
              rawBody: verifiedBody,
              signature: request.headers["x-shopify-hmac-sha256"] ?? null,
              secret: config.webhookSecret.value,
            });
          }

          return yield* resolveWebhookDispatch({
            payload,
            topic,
            products: productStreams,
          });
        }),
        "shopify/webhook/handle",
      ),
  });

  if (Option.isNone(config.webhookSecret)) {
    yield* Effect.logWarning(
      "SHOPIFY_WEBHOOK_SECRET is not set. Incoming webhooks will not be signature-verified.",
    );
  }

  return { connector, routes: [webhookRoute] };
});

export const layerConfig: Layer.Layer<ShopifyConnector, ConnectorError, HttpClient.HttpClient> =
  Layer.effect(ShopifyConnector)(
    Effect.gen(function* () {
      const config = yield* ShopifyConfigConfig;
      return yield* makeShopifyConnector(config).pipe(
        Effect.annotateLogs({ component: "producer-shopify" }),
        Effect.provide(layerApiClient(config)),
      );
    }).pipe(
      Effect.mapError((error) =>
        error instanceof ConnectorError
          ? error
          : new ConnectorError({
              message: "Shopify config failed",
              cause: error,
            }),
      ),
    ),
  );
