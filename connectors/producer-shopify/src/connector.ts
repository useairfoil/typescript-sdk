import {
  Connector,
  ConnectorError,
  Cursor,
  Fetch,
  Resource,
  Webhook,
} from "@useairfoil/connector-kit";
import { Config, Context, DateTime, Effect, Layer, Option, Redacted, Schema } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { createHmac, timingSafeEqual } from "node:crypto";

import type { ShopifyConfig } from "./manifest";

import * as ShopifyApiClient from "./api";
import * as ShopifyAuth from "./auth";
import {
  CartEventSchema,
  CartWebhookEventSchema,
  CartWebhookPayloadSchema,
  ProductDeleteWebhookPayloadSchema,
  ProductEventSchema,
  ProductSchema,
  ProductWebhookPayloadSchema,
  ShopifyNormalize,
} from "./schemas";
export { manifest, ShopifyConfigDef } from "./manifest";
export type { ShopifyConfig } from "./manifest";

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

const decodeWebhookPayload = <A>(schema: Schema.Decoder<A>) => Schema.decodeUnknownEffect(schema);

export const make = Effect.fnUntraced(function* (config: ShopifyConfig) {
  const api = yield* ShopifyApiClient.ShopifyApiClient;

  const Products = Resource.entity({
    name: "products",
    rowSchema: ProductSchema,
    key: "id",
    version: "updatedAt",

    check: api.checkProductsAccess,
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: ({ pageCursor, cutoff }) => {
        const cutoffDate = DateTime.make(String(cutoff));
        if (Option.isNone(cutoffDate)) {
          return Effect.fail(new ConnectorError({ message: "Invalid backfill cutoff" }));
        }
        const cutoffTime = DateTime.toEpochMillis(cutoffDate.value);

        return api
          .fetchProducts({
            first: 50,
            after: typeof pageCursor === "string" ? pageCursor : undefined,
          })
          .pipe(
            Effect.map((page) => ({
              rows: page.items.filter((row) => row.updatedAt.getTime() <= cutoffTime),
              nextPageCursor: page.endCursor ?? undefined,
              hasMore: page.hasMore,
            })),
          );
      },
    }),
    webhook: {
      schema: ProductEventSchema,
      handler: ({ payload }) => {
        if (payload._tag === "delete") {
          return Effect.succeed([
            {
              id: `gid://shopify/Product/${payload.id}`,
              updatedAt: payload.version,
              _af_deleted: true,
            },
          ]);
        }

        const product = payload.payload;
        if (
          product.created_at !== null &&
          product.variants.length === product.variant_gids.length
        ) {
          return Effect.succeed([
            ShopifyNormalize.productWebhook({ ...product, created_at: product.created_at }),
          ]);
        }

        // Refetch when Shopify truncates variants or omits the creation time.
        return api.fetchProductById(product.admin_graphql_api_id).pipe(Effect.map((row) => [row]));
      },
    },
  });

  const CartEvents = Resource.entity({
    name: "cart_events",
    rowSchema: CartEventSchema,
    key: "id",
    version: "updatedAt",

    check: api.checkConnection,
    webhook: {
      schema: CartWebhookEventSchema,
      handler: ({ payload }) =>
        Effect.succeed([ShopifyNormalize.cartWebhook(payload, payload.topic)]),
    },
  });

  const webhookRoute = Webhook.route({
    path: "/webhooks/shopify",
    ackMode: "after-ingest",
    schema: Schema.Unknown,
    handler: ({ request, rawBody, payload: json, to }) =>
      Effect.gen(function* () {
        const verificationError = yield* verifyWebhookSignature({
          rawBody,
          signature: request.headers["x-shopify-hmac-sha256"] ?? null,
          secret: Redacted.value(config.webhookSecret),
        }).pipe(Effect.match({ onFailure: (error) => error, onSuccess: () => undefined }));
        if (verificationError) {
          return HttpServerResponse.jsonUnsafe(
            { ok: false, error: verificationError.message },
            { status: 401 },
          );
        }

        const topic = request.headers["x-shopify-topic"] ?? "";
        switch (topic) {
          case "products/create":
          case "products/update": {
            const payload = yield* decodeWebhookPayload(ProductWebhookPayloadSchema)(json).pipe(
              Effect.mapError(
                (cause) =>
                  new ConnectorError({
                    message: `Invalid Shopify webhook payload for ${topic}`,
                    cause,
                  }),
              ),
              Effect.match({
                onFailure: (error) => ({ _tag: "Error" as const, error }),
                onSuccess: (value) => ({ _tag: "Success" as const, value }),
              }),
            );
            if (payload._tag === "Error") {
              return HttpServerResponse.jsonUnsafe(
                { ok: false, error: payload.error.message },
                { status: 400 },
              );
            }
            yield* to(Products, { _tag: "upsert", payload: payload.value });
            break;
          }
          case "products/delete": {
            const triggeredAt = request.headers["x-shopify-triggered-at"];
            if (!triggeredAt) {
              return HttpServerResponse.jsonUnsafe(
                { ok: false, error: "Missing x-shopify-triggered-at header" },
                { status: 400 },
              );
            }
            const version = yield* Schema.decodeUnknownEffect(Schema.DateFromString)(
              triggeredAt,
            ).pipe(Effect.match({ onFailure: () => null, onSuccess: (date) => date }));
            if (version === null) {
              return HttpServerResponse.jsonUnsafe(
                { ok: false, error: "Invalid x-shopify-triggered-at header" },
                { status: 400 },
              );
            }
            const payload = yield* decodeWebhookPayload(ProductDeleteWebhookPayloadSchema)(
              json,
            ).pipe(
              Effect.mapError(
                (cause) =>
                  new ConnectorError({
                    message: "Invalid Shopify webhook payload for products/delete",
                    cause,
                  }),
              ),
              Effect.match({
                onFailure: (error) => ({ _tag: "Error" as const, error }),
                onSuccess: (value) => ({ _tag: "Success" as const, value }),
              }),
            );
            if (payload._tag === "Error") {
              return HttpServerResponse.jsonUnsafe(
                { ok: false, error: payload.error.message },
                { status: 400 },
              );
            }
            yield* to(Products, {
              _tag: "delete",
              id: String(payload.value.id),
              version,
            });
            break;
          }
          case "carts/create":
          case "carts/update": {
            const payload = yield* decodeWebhookPayload(CartWebhookPayloadSchema)(json).pipe(
              Effect.mapError(
                (cause) =>
                  new ConnectorError({
                    message: `Invalid Shopify webhook payload for ${topic}`,
                    cause,
                  }),
              ),
              Effect.match({
                onFailure: (error) => ({ _tag: "Error" as const, error }),
                onSuccess: (value) => ({ _tag: "Success" as const, value }),
              }),
            );
            if (payload._tag === "Error") {
              return HttpServerResponse.jsonUnsafe(
                { ok: false, error: payload.error.message },
                { status: 400 },
              );
            }
            yield* to(CartEvents, { ...payload.value, topic });
            break;
          }
          default:
            yield* Effect.logWarning("Ignoring unknown Shopify webhook topic").pipe(
              Effect.annotateLogs({ topic }),
            );
        }

        return HttpServerResponse.jsonUnsafe({ ok: true });
      }),
  });

  return Connector.define({
    name: "producer-shopify",
    title: "Shopify",
    resources: [Products, CartEvents],
    webhooks: [webhookRoute],
  });
});

export type ShopifyConnectorRuntime = Effect.Success<ReturnType<typeof make>>;

export class ShopifyConnector extends Context.Service<ShopifyConnector, ShopifyConnectorRuntime>()(
  "@useairfoil/producer-shopify/ShopifyConnector",
) {}

export const layer = (config: ShopifyConfig) => {
  const authLayer = ShopifyAuth.layer(config);
  const apiLayer = ShopifyApiClient.layer(config).pipe(Layer.provide(authLayer));

  return Layer.effect(ShopifyConnector)(
    make(config).pipe(Effect.annotateLogs({ component: "producer-shopify" })),
  ).pipe(Layer.provide(apiLayer));
};

export const layerConfig = (config: Config.Wrap<ShopifyConfig>) =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
