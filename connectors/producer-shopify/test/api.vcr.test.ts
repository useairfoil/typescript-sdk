import type { VcrEntry, VcrRequest } from "@useairfoil/effect-vcr";

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { ProductSchema, ShopifyApiClient, ShopifyConnector } from "../src/index";

const normalizeRequestPath = (value: string): string => {
  const url = new URL(value);
  const pairs = Array.from(url.searchParams.entries());
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const query = pairs.map(([k, v]) => `${k}=${v}`).join("&");
  return query.length > 0 ? `${url.pathname}?${query}` : url.pathname;
};

const matchByPathAndMethod = (request: VcrRequest, entry: VcrEntry): boolean =>
  request.method.toUpperCase() === entry.request.method.toUpperCase() &&
  normalizeRequestPath(request.url) === normalizeRequestPath(entry.request.url);

describe("producer-shopify api (vcr)", () => {
  it.effect("replays products list page with VCR", () =>
    Effect.gen(function* () {
      const api = yield* ShopifyApiClient.ShopifyApiClient;
      const result = yield* api.fetchList(ProductSchema, "/products.json", {
        limit: 50,
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(typeof result.hasMore).toBe("boolean");
    }).pipe(
      Effect.provide(
        ShopifyApiClient.layerConfig(ShopifyConnector.ShopifyConfigConfig).pipe(
          Layer.provide(
            VcrHttpClient.layer({
              vcrName: "producer-shopify",
              mode: "auto",
              match: matchByPathAndMethod,
              redact: {
                requestHeaders: ["x-shopify-access-token", "authorization"],
              },
              matchIgnore: {
                requestHeaders: ["x-shopify-access-token", "authorization"],
              },
            }).pipe(
              Layer.provide(FileSystemCassetteStore.layer()),
              Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
            ),
          ),
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                SHOPIFY_API_BASE_URL: "https://nothing-12348377.myshopify.com/admin/api/2026-01",
                SHOPIFY_API_TOKEN: "test-token",
              }),
            ),
          ),
        ),
      ),
      Effect.scoped,
    ),
  );
});
