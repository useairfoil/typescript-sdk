import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConnectorError, Ingestion } from "@useairfoil/connector-kit";
import { Config, ConfigProvider, DateTime, Deferred, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { createHmac } from "node:crypto";

import type { ShopifyApiClientService } from "../src/api";

import { ShopifyApiClient, ShopifyConnector } from "../src/index";
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
  options: [],
  product_type: "Snowboard",
  published_at: null,
  published_scope: "web",
  status: "draft",
  tags: "",
  template_suffix: "",
  title: "Burton Custom Freestyle 151",
  updated_at: "2026-01-09T19:39:49-05:00",
  variants: [],
  vendor: "Burton",
} as const;

const makeApiStub = (): ShopifyApiClientService => ({
  fetchJson: (_schema) => Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
  fetchList: (_schema) => Effect.succeed({ items: [], nextUrl: null, hasMore: false }),
});

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
          Ingestion.runConnector(connector, {
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
      }).pipe(
        Effect.provide(Layer.mergeAll(Ingestion.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(
      Effect.provide(
        Layer.effect(ShopifyConnector.ShopifyConnector)(
          Config.unwrap(ShopifyConnector.ShopifyConfigConfig)
            .asEffect()
            .pipe(Effect.flatMap(ShopifyConnector.make)),
        ).pipe(
          Layer.provide(Layer.succeed(ShopifyApiClient.ShopifyApiClient)(makeApiStub())),
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                SHOPIFY_API_BASE_URL:
                  "https://your-development-store.myshopify.com/admin/api/2026-01",
                SHOPIFY_API_TOKEN: "test-token",
                SHOPIFY_WEBHOOK_SECRET: webhookSecret,
              }),
            ),
          ),
        ),
      ),
      Effect.scoped,
    ),
  );

  it.effect("rejects invalid webhook signatures", () =>
    Effect.gen(function* () {
      const { publishedRef, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* ShopifyConnector.ShopifyConnector;
      const now = yield* DateTime.now;

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.runConnector(connector, {
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
        Effect.provide(Layer.mergeAll(Ingestion.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(
      Effect.provide(
        Layer.effect(ShopifyConnector.ShopifyConnector)(
          Config.unwrap(ShopifyConnector.ShopifyConfigConfig)
            .asEffect()
            .pipe(Effect.flatMap(ShopifyConnector.make)),
        ).pipe(
          Layer.provide(Layer.succeed(ShopifyApiClient.ShopifyApiClient)(makeApiStub())),
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                SHOPIFY_API_BASE_URL:
                  "https://your-development-store.myshopify.com/admin/api/2026-01",
                SHOPIFY_API_TOKEN: "test-token",
                SHOPIFY_WEBHOOK_SECRET: webhookSecret,
              }),
            ),
          ),
        ),
      ),
      Effect.scoped,
    ),
  );
});
