import type { HttpClient } from "effect/unstable/http";

import {
  type ConnectorDefinition,
  ConnectorError,
  defineConnector,
  defineEntity,
  defineEvent,
  Streams,
  Webhook,
} from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Option, Queue } from "effect";
import * as Schema from "effect/Schema";
import { createHmac, timingSafeEqual } from "node:crypto";

import * as ShopifyApiClient from "./api";
import {
  type CartEvent,
  CartEventSchema,
  type CartWebhookPayload,
  CartWebhookPayloadSchema,
  type Product,
  ProductSchema,
  type ProductWebhookPayload,
  ProductWebhookPayloadSchema,
  ShopifyNormalize,
  type WebhookPayload,
  WebhookPayloadSchema,
} from "./schemas";
import {
  dispatchEntityWebhook,
  type EntityStreams,
  makeEntityStreams,
  resolveCursor,
} from "./streams";

export type ShopifyConfig = {
  readonly shopDomain: string;
  readonly apiVersion: string;
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
  shopDomain: Config.string("SHOPIFY_SHOP_DOMAIN"),
  apiVersion: Config.string("SHOPIFY_API_VERSION").pipe(Config.withDefault("2026-04")),
  apiToken: Config.string("SHOPIFY_API_TOKEN"),
  webhookSecret: Config.option(Config.string("SHOPIFY_WEBHOOK_SECRET")),
});

type ProductWebhookTopic = "products/create" | "products/update";

type CartWebhookTopic = "carts/create" | "carts/update";

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

const WebhookDispatch = {
  product: (options: {
    readonly payload: ProductWebhookPayload;
    readonly topic: ProductWebhookTopic;
    readonly products: EntityStreams<Product>;
  }) =>
    Schema.decodeUnknownEffect(ProductSchema)(
      ShopifyNormalize.productWebhook(options.payload),
    ).pipe(
      Effect.mapError(
        (cause) =>
          new ConnectorError({
            message: `Invalid normalized Shopify product row for ${options.topic}`,
            cause,
          }),
      ),
      Effect.flatMap((product) =>
        Effect.logInfo(`webhook ${options.topic}`).pipe(
          Effect.annotateLogs({ id: product.id }),
          Effect.andThen(
            resolveCursor(product, "updatedAt").pipe(
              Effect.flatMap((cursor) =>
                dispatchEntityWebhook({
                  queue: options.products.live,
                  cutoff: options.products.cutoff,
                  row: product,
                  cursor,
                }),
              ),
            ),
          ),
        ),
      ),
    ),

  cart: (options: {
    readonly payload: CartWebhookPayload;
    readonly topic: CartWebhookTopic;
    readonly cartEvents: Streams.WebhookStream<CartEvent>;
  }) => {
    const cart = ShopifyNormalize.cartWebhook(options.payload, options.topic);

    return Effect.logInfo(`webhook ${options.topic}`).pipe(
      Effect.annotateLogs({ id: cart.id }),
      Effect.andThen(
        Queue.offer(options.cartEvents.queue, {
          cursor: cart.updatedAt,
          rows: [cart],
        }),
      ),
      Effect.asVoid,
    );
  },
} as const;

const resolveWebhookDispatch = (options: {
  readonly payload: WebhookPayload;
  readonly topic: string;
  readonly products: EntityStreams<Product>;
  readonly cartEvents: Streams.WebhookStream<CartEvent>;
}): Effect.Effect<void, ConnectorError> => {
  const topic = options.topic;
  switch (topic) {
    case "products/create":
    case "products/update":
      return Schema.decodeUnknownEffect(ProductWebhookPayloadSchema)(options.payload).pipe(
        Effect.mapError(
          (cause) =>
            new ConnectorError({
              message: `Invalid Shopify webhook payload for ${topic}`,
              cause,
            }),
        ),
        Effect.flatMap((payload) =>
          WebhookDispatch.product({ payload, topic, products: options.products }),
        ),
      );
    case "carts/create":
    case "carts/update":
      return Schema.decodeUnknownEffect(CartWebhookPayloadSchema)(options.payload).pipe(
        Effect.mapError(
          (cause) =>
            new ConnectorError({
              message: `Invalid Shopify webhook payload for ${topic}`,
              cause,
            }),
        ),
        Effect.flatMap((payload) =>
          WebhookDispatch.cart({ payload, topic, cartEvents: options.cartEvents }),
        ),
      );
    default: {
      return Effect.logWarning("Ignoring unknown Shopify webhook topic").pipe(
        Effect.annotateLogs({ topic: options.topic }),
        Effect.asVoid,
      );
    }
  }
};

export const make = Effect.fnUntraced(function* (
  config: ShopifyConfig,
): Effect.fn.Return<ShopifyConnectorRuntime, ConnectorError, ShopifyApiClient.ShopifyApiClient> {
  const api = yield* ShopifyApiClient.ShopifyApiClient;
  const cartEventStream = yield* Streams.makeWebhookQueue<CartEvent>({ capacity: 1024 });
  const productStreams = yield* makeEntityStreams<Product>({
    fetchBackfillPage: (cursor) =>
      api
        .fetchProducts({
          first: 50,
          after: typeof cursor === "string" ? cursor : undefined,
        })
        .pipe(
          Effect.map((page) => ({
            cursor: page.endCursor ?? "",
            rows: page.items,
            hasMore: page.hasMore,
          })),
        ),
    cursorField: "updatedAt",
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
    events: [
      defineEvent({
        name: "cart_events",
        schema: CartEventSchema,
        live: cartEventStream,
      }),
    ],
  });

  const webhookRoute = Webhook.route({
    path: "/webhooks/shopify",
    schema: WebhookPayloadSchema,
    handle: (payload, request, rawBody) =>
      Effect.withSpan(
        Effect.gen(function* () {
          const topic = request.headers["x-shopify-topic"] ?? "";
          yield* Effect.annotateCurrentSpan({ "airfoil.webhook.topic": topic });

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
            cartEvents: cartEventStream,
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

export const layer = (
  config: ShopifyConfig,
): Layer.Layer<ShopifyConnector, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(ShopifyConnector)(
    make(config).pipe(
      Effect.annotateLogs({ component: "producer-shopify" }),
      Effect.provide(ShopifyApiClient.layer(config)),
    ),
  );

export const layerConfig = (
  config: Config.Wrap<ShopifyConfig>,
): Layer.Layer<ShopifyConnector, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(ShopifyConnector)(
    Config.unwrap(config)
      .asEffect()
      .pipe(
        Effect.flatMap((config) =>
          make(config).pipe(
            Effect.annotateLogs({ component: "producer-shopify" }),
            Effect.provide(ShopifyApiClient.layer(config)),
          ),
        ),
      ),
  );
