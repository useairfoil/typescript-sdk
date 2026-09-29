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

import * as ShopifyAuth from "./api/auth";
import * as ShopifyApiClient from "./api/client";
import { CartSchema } from "./resources/carts/row";
import {
  CartWebhookEventSchema,
  CartWebhookPayloadSchema,
  fromCartWebhook,
} from "./resources/carts/webhook";
import { CustomerSchema } from "./resources/customers/row";
import {
  CustomerDeleteWebhookPayloadSchema,
  CustomerEmailConsentPayloadSchema,
  CustomerEventSchema,
  CustomerPurchaseSummaryPayloadSchema,
  CustomerSmsConsentPayloadSchema,
  CustomerTagsPayloadSchema,
  CustomerWebhookPayloadSchema,
  fromCustomerEmailConsent,
  fromCustomerPurchaseSummary,
  fromCustomerSmsConsent,
  fromCustomerWebhook,
} from "./resources/customers/webhook";
import { OrderSchema } from "./resources/orders/row";
import {
  fromOrderWebhook,
  OrderDeleteWebhookPayloadSchema,
  OrderEventSchema,
  OrderWebhookPayloadSchema,
} from "./resources/orders/webhook";
import { ProductSchema } from "./resources/products/row";
import {
  fromProductWebhook,
  ProductDeleteWebhookPayloadSchema,
  ProductEventSchema,
  ProductWebhookPayloadSchema,
} from "./resources/products/webhook";
import { RefundSchema } from "./resources/refunds/row";
import {
  fromRefundWebhook,
  RefundEventSchema,
  RefundWebhookPayloadSchema,
} from "./resources/refunds/webhook";
import { gid } from "./resources/shared";
export { manifest, ShopifyConfigDef } from "./manifest";
export type { ShopifyConfig } from "./manifest";

const isValidWebhookSignature = (
  rawBody: Uint8Array,
  signature: string | undefined,
  secret: string,
): boolean => {
  if (!signature) return false;
  const digest = createHmac("sha256", secret).update(Buffer.from(rawBody)).digest();
  const provided = Buffer.from(signature, "base64");
  return provided.length === digest.length && timingSafeEqual(digest, provided);
};

const decodeTriggeredAt = (value: string | undefined) =>
  Option.getOrNull(Schema.decodeUnknownOption(Schema.DateFromString)(value));

/** With `versionOf`, skips rows changed after the cutoff. Webhooks send those. */
const backfillPages = <A extends object>(
  fetchPage: (options: {
    readonly first: number;
    readonly after?: string;
  }) => Effect.Effect<ShopifyApiClient.ShopifyPage<A>, ConnectorError>,
  versionOf?: (row: A) => Date,
) =>
  Fetch.page({
    pageCursor: Cursor.string(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor, cutoff }) => {
      const cutoffDate = DateTime.make(String(cutoff));
      if (Option.isNone(cutoffDate)) {
        return Effect.fail(new ConnectorError({ message: "Invalid backfill cutoff" }));
      }
      const cutoffTime = DateTime.toEpochMillis(cutoffDate.value);

      return fetchPage({
        first: 50,
        after: typeof pageCursor === "string" ? pageCursor : undefined,
      }).pipe(
        Effect.map((page) => ({
          rows:
            versionOf === undefined
              ? page.items
              : page.items.filter((row) => versionOf(row).getTime() <= cutoffTime),
          nextPageCursor: page.endCursor ?? undefined,
          hasMore: page.hasMore,
        })),
      );
    },
  });

export const make = Effect.fnUntraced(function* (config: ShopifyConfig) {
  const api = yield* ShopifyApiClient.ShopifyApiClient;

  const Products = Resource.entity({
    name: "products",
    rowSchema: ProductSchema,
    key: "id",
    version: "updatedAt",

    check: api.checkProductsAccess,
    backfill: backfillPages(api.fetchProducts, (row) => row.updatedAt),
    webhook: {
      schema: ProductEventSchema,
      handler: ({ payload }) => {
        if (payload._tag === "delete") {
          return Effect.succeed([
            {
              id: payload.id,
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
            fromProductWebhook({ ...product, created_at: product.created_at }),
          ]);
        }

        // Refetch when Shopify cuts off variants or leaves out the creation time.
        const triggeredAt = payload.triggeredAt;
        return Effect.gen(function* () {
          const refetched = yield* api.fetchProductById(product.admin_graphql_api_id);
          if (Option.isSome(refetched)) {
            return [refetched.value];
          }
          if (triggeredAt === null) {
            return yield* new ConnectorError({
              message: "Shopify product not found while refreshing from webhook",
            });
          }
          // A deleted product has no updatedAt, so use the webhook time.
          return [{ id: product.admin_graphql_api_id, updatedAt: triggeredAt, _af_deleted: true }];
        });
      },
    },
  });

  const Customers = Resource.entity({
    name: "customers",
    rowSchema: CustomerSchema,
    key: "id",
    version: "updatedAt",

    check: api.checkCustomersAccess,
    // Customer webhooks send partial rows, so keep rows past the cutoff.
    backfill: backfillPages(api.fetchCustomers),
    webhook: {
      schema: CustomerEventSchema,
      handler: ({ payload }) =>
        Effect.gen(function* () {
          if (payload._tag === "upsert") {
            return [payload.row];
          }
          if (payload._tag === "delete") {
            return [{ id: payload.id, updatedAt: payload.version, _af_deleted: true }];
          }
          return Option.match(yield* api.fetchCustomerTags(payload.id), {
            onNone: () => [],
            onSome: (tags) => [{ id: payload.id, updatedAt: payload.version, tags }],
          });
        }),
    },
  });

  const Orders = Resource.entity({
    name: "orders",
    rowSchema: OrderSchema,
    key: "id",
    version: "updatedAt",

    check: api.checkOrdersAccess,
    backfill: backfillPages(api.fetchOrders, (row) => row.updatedAt),
    webhook: {
      schema: OrderEventSchema,
      // Do not refetch. Shopify hides older orders without read_all_orders.
      handler: ({ payload }) =>
        Effect.succeed(
          payload._tag === "delete"
            ? [{ id: payload.id, updatedAt: payload.version, _af_deleted: true }]
            : [fromOrderWebhook(payload.payload)],
        ),
    },
  });

  const Refunds = Resource.entity({
    name: "refunds",
    rowSchema: RefundSchema,
    key: "id",
    // Refund webhooks have no updated_at. A later settlement with the same
    // processedAt may not replace the first row.
    version: "processedAt",

    check: api.checkOrdersAccess,
    backfill: backfillPages(api.fetchRefunds, (row) => row.processedAt),
    webhook: {
      schema: RefundEventSchema,
      handler: ({ payload }) => Effect.succeed([fromRefundWebhook(payload)]),
    },
  });

  const Carts = Resource.entity({
    name: "carts",
    rowSchema: CartSchema,
    key: "id",
    version: "updatedAt",

    check: api.checkConnection,
    webhook: {
      schema: CartWebhookEventSchema,
      handler: ({ payload }) => Effect.succeed([fromCartWebhook(payload, payload.topic)]),
    },
  });

  const webhookRoute = Webhook.route({
    path: "/webhooks/shopify",
    ackMode: "after-ingest",
    schema: Schema.Unknown,
    handler: ({ request, rawBody, payload: json, to }) =>
      Effect.gen(function* () {
        const signature = request.headers["x-shopify-hmac-sha256"];
        if (!isValidWebhookSignature(rawBody, signature, Redacted.value(config.webhookSecret))) {
          return HttpServerResponse.jsonUnsafe(
            { ok: false, error: "Shopify webhook verification failed" },
            { status: 401 },
          );
        }

        const topic = request.headers["x-shopify-topic"] ?? "";
        const payloadApiVersion = request.headers["x-shopify-api-version"];
        if (payloadApiVersion !== undefined && payloadApiVersion !== config.apiVersion) {
          yield* Effect.logWarning("Shopify webhook API version differs from config").pipe(
            Effect.annotateLogs({ topic, payloadApiVersion, apiVersion: config.apiVersion }),
          );
        }
        const triggeredAt = decodeTriggeredAt(request.headers["x-shopify-triggered-at"]);
        const decode = <A>(schema: Schema.Decoder<A>) => Schema.decodeUnknownOption(schema)(json);
        const invalid = HttpServerResponse.jsonUnsafe(
          { ok: false, error: `Invalid Shopify webhook for ${topic}` },
          { status: 400 },
        );

        switch (topic) {
          case "products/create":
          case "products/update": {
            const payload = decode(ProductWebhookPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Products, { _tag: "upsert", payload: payload.value, triggeredAt });
            break;
          }
          case "products/delete": {
            const payload = decode(ProductDeleteWebhookPayloadSchema);
            if (Option.isNone(payload) || triggeredAt === null) return invalid;
            yield* to(Products, {
              _tag: "delete",
              id: gid("Product", payload.value.id),
              version: triggeredAt,
            });
            break;
          }
          case "carts/create":
          case "carts/update": {
            const payload = decode(CartWebhookPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Carts, { ...payload.value, topic });
            break;
          }
          case "customers/create":
          case "customers/disable":
          case "customers/enable":
          case "customers/update": {
            const payload = decode(CustomerWebhookPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Customers, { _tag: "upsert", row: fromCustomerWebhook(payload.value) });
            break;
          }
          case "customers/purchasing_summary": {
            const payload = decode(CustomerPurchaseSummaryPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Customers, {
              _tag: "upsert",
              row: fromCustomerPurchaseSummary(payload.value),
            });
            break;
          }
          case "customers_email_marketing_consent/update": {
            const payload = decode(CustomerEmailConsentPayloadSchema);
            if (Option.isNone(payload) || triggeredAt === null) return invalid;
            yield* to(Customers, {
              _tag: "upsert",
              row: fromCustomerEmailConsent(payload.value, triggeredAt),
            });
            break;
          }
          case "customers_marketing_consent/update": {
            const payload = decode(CustomerSmsConsentPayloadSchema);
            if (Option.isNone(payload) || triggeredAt === null) return invalid;
            yield* to(Customers, {
              _tag: "upsert",
              row: fromCustomerSmsConsent(payload.value, triggeredAt),
            });
            break;
          }
          case "customer.tags_added":
          case "customer.tags_removed": {
            const payload = decode(CustomerTagsPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Customers, {
              _tag: "refresh-tags",
              id: payload.value.customerId,
              version: payload.value.occurredAt,
            });
            break;
          }
          case "customers/delete": {
            const payload = decode(CustomerDeleteWebhookPayloadSchema);
            if (Option.isNone(payload) || triggeredAt === null) return invalid;
            yield* to(Customers, {
              _tag: "delete",
              id: gid("Customer", payload.value.id),
              version: triggeredAt,
            });
            break;
          }
          case "orders/create":
          case "orders/updated": {
            const payload = decode(OrderWebhookPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Orders, { _tag: "upsert", payload: payload.value });
            // Order payloads include every refund.
            for (const refund of payload.value.refunds) {
              yield* to(Refunds, refund);
            }
            break;
          }
          case "orders/delete": {
            const payload = decode(OrderDeleteWebhookPayloadSchema);
            if (Option.isNone(payload) || triggeredAt === null) return invalid;
            yield* to(Orders, {
              _tag: "delete",
              id: gid("Order", payload.value.id),
              version: triggeredAt,
            });
            break;
          }
          case "refunds/create": {
            const payload = decode(RefundWebhookPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Refunds, payload.value);
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
    resources: [Products, Carts, Customers, Orders, Refunds],
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
