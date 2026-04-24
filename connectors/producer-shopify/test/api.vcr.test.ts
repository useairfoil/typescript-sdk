import { NodeFileSystem, NodeHttpClient } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  CassetteStoreLive,
  type VcrEntry,
  VcrHttpClientLayer,
  type VcrRequest,
} from "@useairfoil/effect-http-client";
import { ConfigProvider, Effect, Layer } from "effect";
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

    const cassetteLayer = CassetteStoreLive.pipe(
      Layer.provide(NodeFileSystem.layer),
    );
    const vcrLayer = VcrHttpClientLayer({
      connectorName: "producer-shopify",
      mode: "replay",
      match: matchByPathAndMethod,
      redact: {
        requestHeaders: ["x-shopify-access-token", "authorization"],
      },
      matchIgnore: {
        requestHeaders: ["x-shopify-access-token", "authorization"],
      },
    }).pipe(
      Layer.provide(Layer.mergeAll(NodeHttpClient.layerFetch, cassetteLayer)),
    );

    return program.pipe(
      Effect.provide(apiLayer),
      Effect.provide(vcrLayer),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv(),
      ),
      Effect.scoped,
    );
  });
});
