import {
  Connector,
  ConnectorError,
  Cursor,
  Fetch,
  Resource,
  Webhook,
} from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Option, Redacted, Schema } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { createHmac, timingSafeEqual } from "node:crypto";

import type { ShopifyConfig } from "./manifest";

import * as ShopifyApiClient from "./api";
import {
  CartEventSchema,
  CartWebhookPayloadSchema,
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
    schema: ProductSchema,
    key: "id",
    version: "updatedAt",
    check: api.fetchProducts({ first: 1 }).pipe(Effect.asVoid),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: ({ pageCursor, cutoff }) =>
        api
          .fetchProducts({
            first: 50,
            after: typeof pageCursor === "string" ? pageCursor : undefined,
          })
          .pipe(
            Effect.map((page) => ({
              mutations: page.items
                .filter((row) => Date.parse(row.updatedAt) <= Date.parse(String(cutoff)))
                .map(Resource.upsert),
              nextPageCursor: page.endCursor ?? undefined,
              hasMore: page.hasMore,
            })),
          ),
    }),
    webhook: Resource.webhook({
      schema: ProductWebhookPayloadSchema,
      handler: ({ payload }) =>
        Schema.decodeUnknownEffect(ProductSchema)(ShopifyNormalize.productWebhook(payload)).pipe(
          Effect.mapError(
            (cause) =>
              new ConnectorError({
                message: "Invalid normalized Shopify product row",
                cause,
              }),
          ),
          Effect.map((row) => [Resource.upsert(row)]),
        ),
    }),
  });

  const CartEvents = Resource.entity({
    name: "cart_events",
    schema: CartEventSchema,
    key: "id",
    version: "updatedAt",
    check: api.checkConnection,
    webhook: Resource.webhook({
      schema: Schema.Struct({
        ...CartWebhookPayloadSchema.fields,
        topic: Schema.Literals(["carts/create", "carts/update"]),
      }),
      handler: ({ payload }) =>
        Effect.succeed([Resource.upsert(ShopifyNormalize.cartWebhook(payload, payload.topic))]),
    }),
  });

  const webhookRoute = Webhook.route({
    path: "/webhooks/shopify",
    ackMode: "after-publish",
    schema: Schema.Unknown,
    handler: ({ request, rawBody, payload: json, to }) =>
      Effect.gen(function* () {
        if (Option.isSome(config.webhookSecret)) {
          const verificationError = yield* verifyWebhookSignature({
            rawBody,
            signature: request.headers["x-shopify-hmac-sha256"] ?? null,
            secret: Redacted.value(config.webhookSecret.value),
          }).pipe(Effect.match({ onFailure: (error) => error, onSuccess: () => undefined }));
          if (verificationError) {
            return HttpServerResponse.jsonUnsafe(
              { ok: false, error: verificationError.message },
              { status: 401 },
            );
          }
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
            yield* to(Products, payload.value);
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

  if (Option.isNone(config.webhookSecret)) {
    yield* Effect.logWarning(
      "SHOPIFY_WEBHOOK_SECRET is not set. Incoming webhooks will not be signature-verified.",
    );
  }

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

export const layer = (config: ShopifyConfig) =>
  Layer.effect(ShopifyConnector)(
    make(config).pipe(Effect.annotateLogs({ component: "producer-shopify" })),
  ).pipe(Layer.provide(ShopifyApiClient.layer(config)));

export const layerConfig = (config: Config.Wrap<ShopifyConfig>) =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
