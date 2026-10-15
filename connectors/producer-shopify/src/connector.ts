import {
  Connector,
  ConnectorError,
  Cursor,
  Fetch,
  Resource,
  Webhook,
} from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Option, Redacted, Schema } from "effect";
import { HttpServerResponse } from "effect/http";
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

const backfillPages = <A extends object>(
  fetchPage: (options: {
    readonly first: number;
    readonly after?: string;
  }) => Effect.Effect<ShopifyApiClient.ShopifyPage<A>, ConnectorError>,
) =>
  Fetch.page({
    pageCursor: Cursor.string(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor }) =>
      fetchPage({
        first: 50,
        after: typeof pageCursor === "string" ? pageCursor : undefined,
      }).pipe(
        Effect.map((page) => ({
          rows: page.items,
          nextPageCursor: page.endCursor ?? undefined,
          hasMore: page.hasMore,
        })),
      ),
  });

export const make = Effect.fnUntraced(function* (config: ShopifyConfig) {
  const api = yield* ShopifyApiClient.ShopifyApiClient;

  const Products = Resource.entity({
    name: "products",
    rowSchema: ProductSchema,
    version: "updatedAt",

    check: api.checkProductsAccess,
    backfill: backfillPages(api.fetchProducts),
    webhook: {
      schema: ProductEventSchema,
      handler: ({ payload }) => {
        if (payload._tag === "delete") {
          return Effect.succeed([
            {
              id: payload.id,
              updatedAt: payload.version,
              _deleted: true,
            },
          ]);
        }

        const product = payload.payload;
        if (product.variants.length === product.variant_gids.length) {
          return Effect.succeed([fromProductWebhook(product)]);
        }

        // Refetch when Shopify cuts off variants.
        const triggeredAt = payload.triggeredAt;
        return Effect.gen(function* () {
          const refetched = yield* api.fetchProductById(product.admin_graphql_api_id);
          if (Option.isSome(refetched)) {
            return [refetched.value];
          }
          // A deleted product has no updatedAt, so use the webhook time.
          return [{ id: product.admin_graphql_api_id, updatedAt: triggeredAt, _deleted: true }];
        });
      },
    },
  });

  const Customers = Resource.entity({
    name: "customers",
    rowSchema: CustomerSchema,
    version: "updatedAt",

    check: api.checkCustomersAccess,
    backfill: backfillPages(api.fetchCustomers),
    webhook: {
      schema: CustomerEventSchema,
      handler: ({ payload: { _tag, id, version } }) =>
        Effect.gen(function* () {
          // No customer means it was deleted. Its delete webhook can be missed.
          const customer = _tag === "refresh" ? yield* api.fetchCustomerById(id) : Option.none();
          return Option.isNone(customer)
            ? [{ id, updatedAt: version, _deleted: true }]
            : [customer.value];
        }),
    },
  });

  const Orders = Resource.entity({
    name: "orders",
    rowSchema: OrderSchema,
    version: "updatedAt",

    check: api.checkOrdersAccess,
    backfill: backfillPages(api.fetchOrders),
    webhook: {
      schema: OrderEventSchema,
      // Do not refetch. Shopify hides older orders without read_all_orders.
      handler: ({ payload }) =>
        Effect.succeed(
          payload._tag === "delete"
            ? [{ id: payload.id, updatedAt: payload.version, _deleted: true }]
            : [fromOrderWebhook(payload.payload)],
        ),
    },
  });

  const Refunds = Resource.entity({
    name: "refunds",
    rowSchema: RefundSchema,
    // Refund webhooks have no updated_at. A later settlement with the same
    // processedAt may not replace the first row.
    version: "processedAt",

    check: api.checkOrdersAccess,
    backfill: backfillPages(api.fetchRefunds),
    webhook: {
      schema: RefundEventSchema,
      handler: ({ payload }) => Effect.succeed([fromRefundWebhook(payload)]),
    },
  });

  const Carts = Resource.entity({
    name: "carts",
    rowSchema: CartSchema,
    version: "updatedAt",

    check: api.checkConnection,
    webhook: {
      schema: CartWebhookEventSchema,
      handler: ({ payload }) => Effect.succeed([fromCartWebhook(payload)]),
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
        const decode = <A>(schema: Schema.Decoder<A>) => Schema.decodeUnknownOption(schema)(json);
        const invalid = HttpServerResponse.jsonUnsafe(
          { ok: false, error: `Invalid Shopify webhook for ${topic}` },
          { status: 400 },
        );
        // Shopify sends it on every webhook.
        const triggeredAt = decodeTriggeredAt(request.headers["x-shopify-triggered-at"]);
        if (triggeredAt === null) return invalid;

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
            if (Option.isNone(payload)) return invalid;
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
            yield* to(Customers, {
              _tag: "refresh",
              id: payload.value.admin_graphql_api_id,
              version: payload.value.updated_at,
            });
            break;
          }
          case "customers/purchasing_summary": {
            const payload = decode(CustomerPurchaseSummaryPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Customers, {
              _tag: "refresh",
              id: payload.value.customerId,
              version: payload.value.occurredAt,
            });
            break;
          }
          case "customers_email_marketing_consent/update": {
            const payload = decode(CustomerEmailConsentPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Customers, {
              _tag: "refresh",
              id: gid("Customer", payload.value.customer_id),
              version: triggeredAt,
            });
            break;
          }
          case "customers_marketing_consent/update": {
            const payload = decode(CustomerSmsConsentPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Customers, {
              _tag: "refresh",
              id: gid("Customer", payload.value.id),
              version: triggeredAt,
            });
            break;
          }
          case "customer.tags_added":
          case "customer.tags_removed": {
            const payload = decode(CustomerTagsPayloadSchema);
            if (Option.isNone(payload)) return invalid;
            yield* to(Customers, {
              _tag: "refresh",
              id: payload.value.customerId,
              version: payload.value.occurredAt,
            });
            break;
          }
          case "customers/delete": {
            const payload = decode(CustomerDeleteWebhookPayloadSchema);
            if (Option.isNone(payload)) return invalid;
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
            break;
          }
          case "orders/delete": {
            const payload = decode(OrderDeleteWebhookPayloadSchema);
            if (Option.isNone(payload)) return invalid;
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
