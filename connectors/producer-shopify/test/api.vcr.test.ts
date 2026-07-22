import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

import { ShopifyApiClient, ShopifyConnector } from "../src/index";

const shopDomain = "your-development-store.myshopify.com";
const apiVersion = "2026-04";
const apiToken = "test-token";
const webhookSecret = "test-webhook-secret";

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
    SHOPIFY_SHOP_DOMAIN: shopDomain,
    SHOPIFY_API_VERSION: apiVersion,
    SHOPIFY_API_TOKEN: apiToken,
    SHOPIFY_WEBHOOK_SECRET: webhookSecret,
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

      expect({
        itemCount: result.items.length,
        firstItem: {
          idPrefix: result.items[0]?.id.split("/").slice(0, -1).join("/"),
          legacyResourceIdIsNumeric: /^\d+$/.test(result.items[0]?.legacyResourceId ?? ""),
          updatedAtType: typeof result.items[0]?.updatedAt,
        },
        hasMore: result.hasMore,
      }).toMatchInlineSnapshot(`
        {
          "firstItem": {
            "idPrefix": "gid://shopify/Product",
            "legacyResourceIdIsNumeric": true,
            "updatedAtType": "string",
          },
          "hasMore": false,
          "itemCount": 17,
        }
      `);
    }).pipe(
      Effect.provide(
        ShopifyApiClient.layerConfig(ShopifyConnector.ShopifyConfigDef.config).pipe(
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
        ShopifyApiClient.layerConfig(ShopifyConnector.ShopifyConfigDef.config).pipe(
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

  it.effect("does not expose provider data when response decoding fails", () =>
    Effect.gen(function* () {
      const providerSecret = "provider-value-that-must-not-leak";
      const api = yield* ShopifyApiClient.make({
        shopDomain,
        apiVersion,
        apiToken: Redacted.make(apiToken),
        webhookSecret: Redacted.make(webhookSecret),
      }).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          makeJsonClient({ data: { products: providerSecret } }),
        ),
      );

      const error = yield* api.fetchProducts({ first: 1 }).pipe(Effect.flip);

      expect(error.message).toBe("Shopify GraphQL response schema decode failed");
      expect(error.cause).toBeUndefined();
      expect(JSON.stringify(error)).not.toContain(providerSecret);
    }),
  );
});
