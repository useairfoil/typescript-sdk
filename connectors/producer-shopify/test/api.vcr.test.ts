import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

import { ShopifyApiClient, ShopifyConnector } from "../src/index";

const makeJsonClient = (body: unknown, status = 200) =>
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      ),
    ),
  );

const configLayer = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    SHOPIFY_SHOP_DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN ?? "your-development-store.myshopify.com",
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION ?? "2026-04",
    SHOPIFY_API_TOKEN: process.env.SHOPIFY_API_TOKEN ?? "test-token",
  }),
);

const parseGraphQLBody = (body: string | undefined) => {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body) as {
      readonly query?: unknown;
      readonly variables?: { readonly first?: unknown; readonly after?: unknown };
    };
    return {
      query: parsed.query,
      first: parsed.variables?.first,
      after: parsed.variables?.after ?? null,
    };
  } catch {
    return undefined;
  }
};

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-shopify",
  redact: {
    requestHeaders: ["x-shopify-access-token"],
    responseHeaders: [
      "content-security-policy",
      "report-to",
      "reporting-endpoints",
      "server-timing",
      "x-request-id",
      "x-stats-apiclientid",
      "x-stats-apipermissionid",
      "x-stats-userid",
    ],
  },
  matchIgnore: {
    requestHeaders: ["x-shopify-access-token"],
  },
  match: (request, entry) => {
    const requestUrl = new URL(request.url);
    const entryUrl = new URL(entry.request.url);
    const requestBody = parseGraphQLBody(request.body);
    const entryBody = parseGraphQLBody(entry.request.body);
    return (
      request.method === entry.request.method &&
      requestUrl.pathname === entryUrl.pathname &&
      requestBody?.query === entryBody?.query &&
      requestBody?.first === entryBody?.first &&
      requestBody?.after === entryBody?.after
    );
  },
}).pipe(
  Layer.provide(FileSystemCassetteStore.layer()),
  Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
);

describe("producer-shopify api (vcr)", () => {
  it.effect("replays GraphQL products page with VCR", () =>
    Effect.gen(function* () {
      const api = yield* ShopifyApiClient.ShopifyApiClient;
      const result = yield* api.fetchProducts({ first: 50 });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]?.id).toMatch(/^gid:\/\/shopify\/Product\//);
      expect(result.items[0]?.legacyResourceId).toMatch(/^\d+$/);
      expect(result.items[0]?.updatedAt).toEqual(expect.any(String));
      expect(result.hasMore).toBe(false);
    }).pipe(
      Effect.provide(
        ShopifyApiClient.layerConfig(ShopifyConnector.ShopifyConfigConfig).pipe(
          Layer.provide(vcrLayer),
          Layer.provide(configLayer),
        ),
      ),
      Effect.scoped,
    ),
  );

  it.effect("fails on GraphQL errors", () =>
    Effect.gen(function* () {
      const api = yield* ShopifyApiClient.ShopifyApiClient;
      const exit = yield* Effect.exit(api.fetchProducts({ first: 50 }));

      expect(exit._tag).toBe("Failure");
    }).pipe(
      Effect.provide(
        ShopifyApiClient.layerConfig(ShopifyConnector.ShopifyConfigConfig).pipe(
          Layer.provide(
            Layer.succeed(HttpClient.HttpClient)(
              makeJsonClient({
                errors: [{ message: "Access denied", extensions: { code: "ACCESS_DENIED" } }],
              }),
            ),
          ),
          Layer.provide(configLayer),
        ),
      ),
      Effect.scoped,
    ),
  );
});
