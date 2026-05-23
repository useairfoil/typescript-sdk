import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConnectorError, Ingestion, StateStore } from "@useairfoil/connector-kit";
import { Config, ConfigProvider, DateTime, Deferred, Effect, Layer, Ref, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { createHmac } from "node:crypto";

import type { ShopifyApiClientService } from "../src/api";

import { ProductSchema, ShopifyApiClient, ShopifyConnector } from "../src/index";
import { makeTestPublisher } from "./helpers";

const webhookSecret = "test-shopify-webhook-secret";

const productWebhookPayload = {
  id: 1072481062,
  admin_graphql_api_id: "gid://shopify/Product/1072481062",
  body_html: "<strong>Good snowboard!</strong>",
  created_at: "2026-01-09T19:39:49-05:00",
  handle: "burton-custom-freestyle-151",
  image: null,
  images: [],
  options: [
    {
      id: 1064576516,
      name: "Title",
      position: 1,
      values: ["Default Title"],
    },
  ],
  product_type: "Snowboard",
  published_at: null,
  published_scope: "web",
  status: "draft",
  tags: "",
  template_suffix: "",
  title: "Burton Custom Freestyle 151",
  updated_at: "2026-01-09T19:39:49-05:00",
  variants: [
    {
      id: 1070325053,
      title: "Default Title",
      price: "0.00",
      inventory_policy: "deny",
      compare_at_price: null,
      created_at: "2026-01-09T19:39:49-05:00",
      updated_at: "2026-01-09T19:39:49-05:00",
      taxable: true,
      barcode: null,
      sku: null,
      admin_graphql_api_id: "gid://shopify/ProductVariant/1070325053",
    },
  ],
  vendor: "Burton",
} as const;

const cartWebhookPayload = {
  id: "exampleCartId",
  token: "exampleCartId",
  line_items: [
    {
      id: 1,
      properties: null,
      quantity: 1,
      variant_id: 1,
      key: "1:3abdf474dce81d0025dd15b9a02ef6bf",
      discounted_price: "19.99",
      discounts: [],
      gift_card: false,
      grams: 200,
      line_price: "19.99",
      original_line_price: "19.99",
      original_price: "19.99",
      price: "19.99",
      product_id: 2,
      sku: "example-shirt-s",
      taxable: true,
      title: "Example T-Shirt - Small",
      total_discount: "0.00",
      vendor: "Acme",
      discounted_price_set: {
        shop_money: { amount: "19.99", currency_code: "USD" },
        presentment_money: { amount: "19.99", currency_code: "USD" },
      },
      line_price_set: {
        shop_money: { amount: "19.99", currency_code: "USD" },
        presentment_money: { amount: "19.99", currency_code: "USD" },
      },
      original_line_price_set: {
        shop_money: { amount: "19.99", currency_code: "USD" },
        presentment_money: { amount: "19.99", currency_code: "USD" },
      },
      price_set: {
        shop_money: { amount: "19.99", currency_code: "USD" },
        presentment_money: { amount: "19.99", currency_code: "USD" },
      },
      total_discount_set: {
        shop_money: { amount: "0.00", currency_code: "USD" },
        presentment_money: { amount: "0.00", currency_code: "USD" },
      },
      parent_relationship: null,
    },
  ],
  note: null,
  updated_at: "2022-01-01T00:00:00.000Z",
  created_at: "2022-01-01T00:00:00.000Z",
} as const;

const makeApiStub = (): ShopifyApiClientService => ({
  fetchGraphQL: (_options) =>
    Effect.fail(new ConnectorError({ message: "Unexpected fetchGraphQL" })),
  fetchProducts: (_options) => Effect.succeed({ items: [], endCursor: null, hasMore: false }),
});

const connectorTestLayer = Layer.effect(ShopifyConnector.ShopifyConnector)(
  Config.unwrap(ShopifyConnector.ShopifyConfigConfig)
    .asEffect()
    .pipe(Effect.flatMap(ShopifyConnector.make)),
).pipe(
  Layer.provide(Layer.succeed(ShopifyApiClient.ShopifyApiClient)(makeApiStub())),
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        SHOPIFY_SHOP_DOMAIN: "your-development-store.myshopify.com",
        SHOPIFY_API_VERSION: "2026-04",
        SHOPIFY_API_TOKEN: "test-token",
        SHOPIFY_WEBHOOK_SECRET: webhookSecret,
      }),
    ),
  ),
);

const signPayload = (rawBody: string): string =>
  createHmac("sha256", webhookSecret).update(rawBody).digest("base64");

describe("producer-shopify webhook", () => {
  it.effect("publishes live product webhook batches", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now;

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes,
            },
          }),
        );

        const rawBody = JSON.stringify(productWebhookPayload);
        const signature = signPayload(rawBody);

        const client = yield* HttpClient.HttpClient;
        const request = HttpClientRequest.post("/webhooks/shopify").pipe(
          HttpClientRequest.setHeader("x-shopify-topic", "products/create"),
          HttpClientRequest.setHeader("x-shopify-hmac-sha256", signature),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(200);

        yield* Deferred.await(done);
        const published = yield* Ref.get(publishedRef);
        expect(published.length).toBe(1);
        expect(published[0]?.name).toBe("products");
        const row = published[0]?.batch.rows[0];
        const product = yield* Schema.decodeUnknownEffect(ProductSchema)(row);
        expect(product.id).toBe(productWebhookPayload.admin_graphql_api_id);
        expect(product.legacyResourceId).toBe(String(productWebhookPayload.id));
        expect(product.updatedAt).toBe(productWebhookPayload.updated_at);
        expect(product.productType).toBe(productWebhookPayload.product_type);
        expect(product.status).toBe("DRAFT");
        expect(product.options[0]).toMatchObject({
          id: String(productWebhookPayload.options[0].id),
          name: productWebhookPayload.options[0].name,
        });
        expect(product.variantsFirstPage[0]).toMatchObject({
          id: productWebhookPayload.variants[0].admin_graphql_api_id,
          legacyResourceId: String(productWebhookPayload.variants[0].id),
          inventoryPolicy: "DENY",
        });
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );

  it.effect("publishes cart webhook events", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now;

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes,
            },
          }),
        );

        const rawBody = JSON.stringify(cartWebhookPayload);
        const signature = signPayload(rawBody);

        const client = yield* HttpClient.HttpClient;
        const request = HttpClientRequest.post("/webhooks/shopify").pipe(
          HttpClientRequest.setHeader("x-shopify-topic", "carts/create"),
          HttpClientRequest.setHeader("x-shopify-hmac-sha256", signature),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(200);

        yield* Deferred.await(done);
        const published = yield* Ref.get(publishedRef);
        expect(published.length).toBe(1);
        expect(published[0]?.name).toBe("cart_events");
        const row = published[0]?.batch.rows[0];
        expect(row?.id).toBe(cartWebhookPayload.id);
        expect(row?.token).toBe(cartWebhookPayload.token);
        expect(row?.topic).toBe("carts/create");
        expect(row?.updatedAt).toBe(cartWebhookPayload.updated_at);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );

  it.effect("rejects invalid webhook signatures", () =>
    Effect.gen(function* () {
      const { publishedRef, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now;

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes,
            },
          }),
        );

        const rawBody = JSON.stringify(productWebhookPayload);
        const invalidSignature = signPayload(`${rawBody}-invalid`);

        const client = yield* HttpClient.HttpClient;
        const request = HttpClientRequest.post("/webhooks/shopify").pipe(
          HttpClientRequest.setHeader("x-shopify-topic", "products/create"),
          HttpClientRequest.setHeader("x-shopify-hmac-sha256", invalidSignature),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(500);
        const published = yield* Ref.get(publishedRef);
        expect(published.length).toBe(0);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );
});
