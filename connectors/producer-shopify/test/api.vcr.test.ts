import type { VcrEntry, VcrRequest } from "@useairfoil/effect-vcr";

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { makeShopifyApiClient, ShopifyApiClient } from "../src/api";
import { ProductSchema, ShopifyConfigConfig } from "../src/index";

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
  it.effect("replays products list page with VCR", () => {
    const program = Effect.gen(function* () {
      const api = yield* ShopifyApiClient;
      const result = yield* api.fetchList(ProductSchema, "/products.json", {
        limit: 50,
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(typeof result.hasMore).toBe("boolean");
    }).pipe(Effect.scoped);

    const apiLayer = Layer.effect(ShopifyApiClient)(
      Effect.gen(function* () {
        const config = yield* ShopifyConfigConfig;
        return yield* makeShopifyApiClient(config);
      }),
    );

    const cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(
      Layer.provide(NodeServices.layer),
    );
    const vcrRuntimeLayer = Layer.mergeAll(
      FetchHttpClient.layer,
      NodeServices.layer,
      cassetteStoreLayer,
    );
    const vcrWithDeps = VcrHttpClient.layer({
      vcrName: "producer-shopify",
      mode: "auto",
      match: matchByPathAndMethod,
      redact: {
        requestHeaders: ["x-shopify-access-token", "authorization"],
      },
      matchIgnore: {
        requestHeaders: ["x-shopify-access-token", "authorization"],
      },
    }).pipe(Layer.provide(vcrRuntimeLayer));

    const testLayer = apiLayer.pipe(
      Layer.provide(vcrWithDeps),
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            SHOPIFY_API_BASE_URL: "https://nothing-12348377.myshopify.com/admin/api/2026-01",
            SHOPIFY_API_TOKEN: "test-token",
          }),
        ),
      ),
    );

    return program.pipe(Effect.provide(testLayer), Effect.scoped);
  });
});
