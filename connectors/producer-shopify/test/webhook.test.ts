import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConnectorError, Ingestion, Resource, StateStore } from "@useairfoil/connector-kit";
import { ConfigProvider, DateTime, Deferred, Effect, Layer, Ref, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { createHmac } from "node:crypto";

import type { ShopifyApiClientService } from "../src/api";

import {
  CartEventSchema,
  type Product,
  type ProductWebhookPayload,
  ProductSchema,
  ShopifyApiClient,
  ShopifyConnector,
  ShopifyNormalize,
} from "../src/index";
import { makeTestPublisher } from "./helpers";

const webhookSecret = "test-shopify-webhook-secret";

const productWebhookPayload = {
  id: 1072481062,
  admin_graphql_api_id: "gid://shopify/Product/1072481062",
  body_html: "<strong>Good snowboard!</strong>",
  created_at: "2026-01-09T19:39:49-05:00",
  handle: "burton-custom-freestyle-151",
  image: {
    src: "https://cdn.shopify.com/product.png",
    alt: "Product image",
  },
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
  variant_gids: [
    {
      admin_graphql_api_id: "gid://shopify/ProductVariant/1070325053",
      updated_at: "2026-01-09T19:39:49-05:00",
    },
  ],
  vendor: "Burton",
} as const;

const truncatedProductWebhookPayload = {
  ...productWebhookPayload,
  variant_gids: [
    ...productWebhookPayload.variant_gids,
    {
      admin_graphql_api_id: "gid://shopify/ProductVariant/1070325054",
      updated_at: "2026-01-09T19:39:49-05:00",
    },
  ],
} as const;

const productWebhookPayloadWithoutCreatedAt = {
  ...productWebhookPayload,
  created_at: null,
} as const;

const productDeleteWebhookRawBody = '{"id":9169918886100}';

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

const canonicalProduct: Product = ShopifyNormalize.productWebhook(productWebhookPayload);
const refetchedProduct: Product = {
  ...canonicalProduct,
  title: "Refetched product",
};

const makeApiStub = (): ShopifyApiClientService => ({
  checkConnection: Effect.void,
  checkProductsAccess: Effect.void,
  fetchGraphQL: (_options) =>
    Effect.fail(new ConnectorError({ message: "Unexpected fetchGraphQL" })),
  fetchProducts: (_options) => Effect.succeed({ items: [], endCursor: null, hasMore: false }),
  fetchProductById: (id) =>
    Effect.fail(new ConnectorError({ message: `Unexpected fetchProductById(${id})` })),
});

const makeConnectorTestLayer = (api: ShopifyApiClientService) =>
  Layer.effect(ShopifyConnector.ShopifyConnector)(
    ShopifyConnector.ShopifyConfigDef.config.pipe(Effect.flatMap(ShopifyConnector.make)),
  ).pipe(
    Layer.provide(Layer.succeed(ShopifyApiClient.ShopifyApiClient)(api)),
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          SHOPIFY_SHOP_DOMAIN: "your-development-store.myshopify.com",
          SHOPIFY_API_VERSION: "2026-07",
          SHOPIFY_CLIENT_ID: "test-client-id",
          SHOPIFY_CLIENT_SECRET: "test-client-secret",
          SHOPIFY_WEBHOOK_SECRET: webhookSecret,
        }),
      ),
    ),
  );

const connectorTestLayer = makeConnectorTestLayer(makeApiStub());

const signPayload = (rawBody: string): string =>
  createHmac("sha256", webhookSecret).update(rawBody).digest("base64");

const expectProductWebhookRefetch = (payload: ProductWebhookPayload) =>
  Effect.gen(function* () {
    const fetchCount = yield* Ref.make(0);

    yield* Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(2);
      const connector = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes: connector.webhooks ?? [],
            },
          }),
        );

        const rawBody = JSON.stringify(payload);
        const signature = signPayload(rawBody);

        const client = yield* HttpClient.HttpClient;
        const request = HttpClientRequest.post("/webhooks/shopify").pipe(
          HttpClientRequest.setHeader("x-shopify-topic", "products/update"),
          HttpClientRequest.setHeader("x-shopify-hmac-sha256", signature),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(200);

        yield* Deferred.await(done);
        const published = yield* Ref.get(publishedRef);
        const webhookPublish = published.find(
          (item) => item.source === "webhook" && item.resource === "products",
        );
        expect(webhookPublish?.batch.mutations[0]).toEqual(Resource.upsert(refetchedProduct));
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(
      Effect.provide(
        makeConnectorTestLayer({
          ...makeApiStub(),
          fetchProductById: (id) =>
            id === canonicalProduct.id
              ? Ref.update(fetchCount, (count) => count + 1).pipe(Effect.as(refetchedProduct))
              : Effect.fail(new ConnectorError({ message: `Unexpected fetchProductById(${id})` })),
        }),
      ),
      Effect.scoped,
    );

    expect(yield* Ref.get(fetchCount)).toBe(1);
  });

describe("producer-shopify webhook", () => {
  it.effect("publishes live product webhook batches", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(2);
      const connector = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes: connector.webhooks ?? [],
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
        const webhookPublish = published.find(
          (item) => item.source === "webhook" && item.resource === "products",
        );
        const mutation = webhookPublish?.batch.mutations[0];
        const row = mutation?.op === "upsert" ? mutation.row : undefined;
        const product = yield* Schema.decodeUnknownEffect(ProductSchema)(row);
        expect({
          resource: webhookPublish?.resource,
          op: mutation?.op,
          product: {
            id: product.id,
            legacyResourceId: product.legacyResourceId,
            featuredMedia: product.featuredMedia,
            updatedAt: product.updatedAt,
            productType: product.productType,
            status: product.status,
            firstOption: {
              id: product.options[0]?.id,
              name: product.options[0]?.name,
            },
            firstVariant: {
              id: product.variants[0]?.id,
              legacyResourceId: product.variants[0]?.legacyResourceId,
              inventoryPolicy: product.variants[0]?.inventoryPolicy,
            },
          },
        }).toMatchInlineSnapshot(`
          {
            "op": "upsert",
            "product": {
              "featuredMedia": {
                "image": {
                  "altText": "Product image",
                  "url": "https://cdn.shopify.com/product.png",
                },
              },
              "firstOption": {
                "id": "gid://shopify/ProductOption/1064576516",
                "name": "Title",
              },
              "firstVariant": {
                "id": "gid://shopify/ProductVariant/1070325053",
                "inventoryPolicy": "DENY",
                "legacyResourceId": "1070325053",
              },
              "id": "gid://shopify/Product/1072481062",
              "legacyResourceId": "1072481062",
              "productType": "Snowboard",
              "status": "DRAFT",
              "updatedAt": "2026-01-09T19:39:49-05:00",
            },
            "resource": "products",
          }
        `);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );

  it.effect("refetches products with truncated webhook variants", () =>
    expectProductWebhookRefetch(truncatedProductWebhookPayload),
  );

  it.effect("refetches product webhooks without a creation time", () =>
    expectProductWebhookRefetch(productWebhookPayloadWithoutCreatedAt),
  );

  it.effect("publishes signed product delete webhooks", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(2);
      const connector = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
      const triggeredAt = "2026-07-23T10:30:00.000Z";

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes: connector.webhooks ?? [],
            },
          }),
        );

        const rawBody = productDeleteWebhookRawBody;
        const signature = signPayload(rawBody);

        const client = yield* HttpClient.HttpClient;
        const request = HttpClientRequest.post("/webhooks/shopify").pipe(
          HttpClientRequest.setHeader("x-shopify-topic", "products/delete"),
          HttpClientRequest.setHeader("x-shopify-triggered-at", triggeredAt),
          HttpClientRequest.setHeader("x-shopify-hmac-sha256", signature),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(200);

        yield* Deferred.await(done);
        const published = yield* Ref.get(publishedRef);
        const webhookPublish = published.find(
          (item) => item.source === "webhook" && item.resource === "products",
        );
        expect(webhookPublish?.batch.mutations[0]).toEqual({
          op: "delete",
          key: "gid://shopify/Product/9169918886100",
          version: triggeredAt,
        });
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );

  it.effect("publishes cart webhook events", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(2);
      const connector = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes: connector.webhooks ?? [],
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
        const webhookPublish = published.find(
          (item) => item.source === "webhook" && item.resource === "cart_events",
        );
        const mutation = webhookPublish?.batch.mutations[0];
        const row = mutation?.op === "upsert" ? mutation.row : undefined;
        const cartEvent = yield* Schema.decodeUnknownEffect(CartEventSchema)(row);
        expect({
          resource: webhookPublish?.resource,
          op: mutation?.op,
          cartEvent: {
            id: cartEvent.id,
            token: cartEvent.token,
            topic: cartEvent.topic,
            updatedAt: cartEvent.updatedAt,
          },
        }).toMatchInlineSnapshot(`
          {
            "cartEvent": {
              "id": "exampleCartId",
              "token": "exampleCartId",
              "topic": "carts/create",
              "updatedAt": "2022-01-01T00:00:00.000Z",
            },
            "op": "upsert",
            "resource": "cart_events",
          }
        `);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );

  it.effect("rejects invalid webhook signatures", () =>
    Effect.gen(function* () {
      const { publishedRef, layer } = yield* makeTestPublisher(1);
      const connector = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes: connector.webhooks ?? [],
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

        expect(response.status).toBe(401);
        const published = yield* Ref.get(publishedRef);
        expect(published.some((item) => item.source === "webhook")).toBe(false);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );
});
