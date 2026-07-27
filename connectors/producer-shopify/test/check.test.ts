import { describe, expect, it } from "@effect/vitest";
import { ConnectorApp, ConnectorError } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import type { ShopifyApiClientService } from "../src/api";

import { ShopifyApiClient, ShopifyConnector } from "../src/index";

describe("producer-shopify configuration checks", () => {
  it.effect("uses the resource-specific read-only checks", () =>
    Effect.gen(function* () {
      const connectionRuns = yield* Ref.make(0);
      const productCheckRuns = yield* Ref.make(0);
      const api: ShopifyApiClientService = {
        checkConnection: Ref.update(connectionRuns, (runs) => runs + 1),
        checkProductsAccess: Ref.update(productCheckRuns, (runs) => runs + 1),
        fetchGraphQL: () => Effect.fail(new ConnectorError({ message: "Unexpected fetchGraphQL" })),
        fetchProducts: () =>
          Effect.fail(new ConnectorError({ message: "Unexpected fetchProducts" })),
        fetchProductById: () =>
          Effect.fail(new ConnectorError({ message: "Unexpected fetchProductById" })),
      };
      const connectorLayer = Layer.effect(ShopifyConnector.ShopifyConnector)(
        ShopifyConnector.ShopifyConfigDef.config.pipe(
          Effect.flatMap(ShopifyConnector.make),
          Effect.provideService(ShopifyApiClient.ShopifyApiClient, api),
        ),
      );

      const result = yield* ConnectorApp.check(ShopifyConnector.ShopifyConnector, connectorLayer, {
        resources: ["products", "cart_events"],
      });

      expect(result).toEqual({
        products: { _tag: "ok" },
        cart_events: { _tag: "ok" },
      });
      expect(yield* Ref.get(productCheckRuns)).toBe(1);
      expect(yield* Ref.get(connectionRuns)).toBe(1);
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            SHOPIFY_SHOP_DOMAIN: "example.myshopify.com",
            SHOPIFY_CLIENT_ID: "test-client-id",
            SHOPIFY_CLIENT_SECRET: "test-client-secret",
            SHOPIFY_WEBHOOK_SECRET: "test-webhook-secret",
          }),
        ),
      ),
    ),
  );

  it.effect("shares one client-credentials exchange across selected resource checks", () =>
    Effect.gen(function* () {
      const tokenRequests = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Effect.gen(function* () {
          const path = new URL(request.url).pathname;
          if (path === "/admin/oauth/access_token") {
            yield* Ref.update(tokenRequests, (count) => count + 1);
            return HttpClientResponse.fromWeb(
              request,
              new Response(JSON.stringify({ access_token: "test-token", expires_in: 86_400 }), {
                status: 200,
                headers: { "content-type": "application/json" },
              }),
            );
          }

          if (request.body._tag !== "Uint8Array") {
            return yield* Effect.die(new Error("Expected a GraphQL request body"));
          }
          const body = new TextDecoder().decode(request.body.body);
          const data = body.includes("AirfoilProductsAccess")
            ? { products: { nodes: [] } }
            : { shop: { id: "gid://shopify/Shop/1" } };

          return HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify({ data }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          );
        }),
      );
      const connectorLayer = ShopifyConnector.layerConfig(
        ShopifyConnector.ShopifyConfigDef.config,
      ).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient)(client)));

      const result = yield* ConnectorApp.check(ShopifyConnector.ShopifyConnector, connectorLayer, {
        resources: ["products", "cart_events"],
      });

      expect(result).toEqual({
        products: { _tag: "ok" },
        cart_events: { _tag: "ok" },
      });
      expect(yield* Ref.get(tokenRequests)).toBe(1);
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            SHOPIFY_SHOP_DOMAIN: "example.myshopify.com",
            SHOPIFY_CLIENT_ID: "test-client-id",
            SHOPIFY_CLIENT_SECRET: "test-client-secret",
            SHOPIFY_WEBHOOK_SECRET: "test-webhook-secret",
          }),
        ),
      ),
    ),
  );
});
