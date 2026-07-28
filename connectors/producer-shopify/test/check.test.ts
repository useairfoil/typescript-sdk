import { describe, expect, it } from "@effect/vitest";
import { ConnectorApp, ConnectorError } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer, Ref } from "effect";

import type { ShopifyApiClientService } from "../src/api";

import { ShopifyApiClient, ShopifyConnector } from "../src/index";

describe("producer-shopify configuration checks", () => {
  it.effect("uses the resource-specific read-only checks", () =>
    Effect.gen(function* () {
      const connectionRuns = yield* Ref.make(0);
      const productRuns = yield* Ref.make(0);
      const api: ShopifyApiClientService = {
        checkConnection: Ref.update(connectionRuns, (runs) => runs + 1),
        fetchGraphQL: () => Effect.fail(new ConnectorError({ message: "Unexpected fetchGraphQL" })),
        fetchProducts: () =>
          Ref.update(productRuns, (runs) => runs + 1).pipe(
            Effect.as({ items: [], endCursor: null, hasMore: false }),
          ),
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
      expect(yield* Ref.get(productRuns)).toBe(1);
      expect(yield* Ref.get(connectionRuns)).toBe(1);
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            SHOPIFY_SHOP_DOMAIN: "example.myshopify.com",
            SHOPIFY_API_TOKEN: "test-token",
          }),
        ),
      ),
    ),
  );
});
