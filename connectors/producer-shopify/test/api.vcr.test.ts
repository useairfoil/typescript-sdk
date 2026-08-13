import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer, Redacted, Ref, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

import * as ShopifyAuth from "../src/auth";
import { ShopifyApiClient, ShopifyConnector } from "../src/index";

const shopDomain = "your-development-store.myshopify.com";
const apiVersion = "2026-07";
const clientId = "test-client-id";
const clientSecret = "test-client-secret";
const apiToken = "test-token";
const webhookSecret = "test-webhook-secret";

const GraphQLRequestSchema = Schema.Struct({
  query: Schema.String,
  variables: Schema.Struct({
    after: Schema.NullOr(Schema.String),
  }),
});

const productVariant = (id: number) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  legacyResourceId: String(id),
  title: `Variant ${id}`,
  sku: null,
  barcode: null,
  price: "10.00",
  compareAtPrice: null,
  inventoryPolicy: "DENY",
  taxable: true,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
});

const productNode = {
  id: "gid://shopify/Product/1",
  legacyResourceId: "1",
  title: "Product 1",
  handle: "product-1",
  descriptionHtml: "",
  productType: "Test",
  vendor: "Airfoil",
  status: "ACTIVE",
  tags: [],
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  publishedAt: null,
  templateSuffix: null,
  featuredMedia: null,
  options: [],
  variants: {
    nodes: [productVariant(1)],
    pageInfo: { hasNextPage: true, endCursor: "variant-cursor-1" },
  },
};

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
  ConfigProvider.orElse(
    ConfigProvider.fromEnv(),
    ConfigProvider.fromUnknown({
      SHOPIFY_SHOP_DOMAIN: shopDomain,
      SHOPIFY_API_VERSION: apiVersion,
      SHOPIFY_CLIENT_ID: clientId,
      SHOPIFY_CLIENT_SECRET: clientSecret,
      SHOPIFY_WEBHOOK_SECRET: webhookSecret,
    }),
  ),
);

const config = {
  shopDomain,
  apiVersion,
  clientId,
  clientSecret: Redacted.make(clientSecret),
  responseMaxRetries: 5,
  transportMaxRetries: 5,
  graphqlMaxRetries: 5,
  retryBaseDelayMs: 200,
  graphqlRetryBaseDelayMs: 500,
  retryAfterFallbackSeconds: 1,
  requestTimeoutSeconds: 120,
  webhookSecret: Redacted.make(webhookSecret),
};

const staticAuthLayer = Layer.succeed(ShopifyAuth.ShopifyAuth)({
  get: Effect.succeed(Redacted.make(apiToken)),
  invalidate: Effect.void,
});

const parseGraphQLBody = (body: string | undefined) => {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body) as {
      readonly query?: unknown;
      readonly variables?: {
        readonly id?: unknown;
        readonly first?: unknown;
        readonly after?: unknown;
      };
    };
    return {
      query: parsed.query,
      id: parsed.variables?.id ?? null,
      first: parsed.variables?.first,
      after: parsed.variables?.after ?? null,
    };
  } catch {
    return undefined;
  }
};

const tokenGrantType = (body: string | undefined): string | null =>
  body ? new URLSearchParams(body).get("grant_type") : null;

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-shopify",
  redact: {
    requestHeaders: ["x-shopify-access-token"],
    requestBodyReplacements: {
      client_id: "shopify-client-id-placeholder",
      client_secret: "shopify-client-secret-placeholder",
    },
    responseBodyReplacements: {
      access_token: "shopify-access-token-placeholder",
    },
    responseHeaders: [
      "content-security-policy",
      "report-to",
      "reporting-endpoints",
      "server-timing",
      "set-cookie",
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
    const isTokenRequest = requestUrl.pathname === "/admin/oauth/access_token";
    if (isTokenRequest || entryUrl.pathname === "/admin/oauth/access_token") {
      return (
        isTokenRequest &&
        entryUrl.pathname === "/admin/oauth/access_token" &&
        request.method === "POST" &&
        entry.request.method === "POST" &&
        tokenGrantType(request.body) === "client_credentials" &&
        tokenGrantType(entry.request.body) === "client_credentials"
      );
    }
    const requestBody = parseGraphQLBody(request.body);
    const entryBody = parseGraphQLBody(entry.request.body);
    return (
      request.method === entry.request.method &&
      requestUrl.pathname === entryUrl.pathname &&
      requestBody?.query === entryBody?.query &&
      requestBody?.id === entryBody?.id &&
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
          Layer.provide(ShopifyAuth.layerConfig(ShopifyConnector.ShopifyConfigDef.config)),
          Layer.provide(vcrLayer),
          Layer.provide(configLayer),
        ),
      ),
      Effect.scoped,
    ),
  );

  it.effect("fetches every nested product variant page", () =>
    Effect.gen(function* () {
      const responses = yield* Ref.make<ReadonlyArray<unknown>>([
        {
          data: {
            products: {
              nodes: [productNode],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
        {
          data: {
            product: {
              variants: {
                nodes: [productVariant(2)],
                pageInfo: { hasNextPage: true, endCursor: "variant-cursor-2" },
              },
            },
          },
        },
        {
          data: {
            product: {
              variants: {
                nodes: [productVariant(3)],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      ]);
      const requestedCursors = yield* Ref.make<ReadonlyArray<string | null>>([]);
      const client = HttpClient.make((request) =>
        Effect.gen(function* () {
          if (request.body._tag !== "Uint8Array") {
            return yield* Effect.die(new Error("Expected a JSON request body"));
          }
          const json: unknown = JSON.parse(new TextDecoder().decode(request.body.body));
          const body = Schema.decodeUnknownSync(GraphQLRequestSchema)(json);
          yield* Ref.update(requestedCursors, (cursors) => [...cursors, body.variables.after]);
          const response = yield* Ref.modify(responses, (remaining) => [
            remaining[0],
            remaining.slice(1),
          ]);
          return HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(response), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          );
        }),
      );
      const api = yield* ShopifyApiClient.make(config).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, {
          get: Effect.succeed(Redacted.make(apiToken)),
          invalidate: Effect.void,
        }),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      const result = yield* api.fetchProducts({ first: 1 });

      expect(result.items[0]?.variants.map((variant) => variant.id)).toEqual([
        "gid://shopify/ProductVariant/1",
        "gid://shopify/ProductVariant/2",
        "gid://shopify/ProductVariant/3",
      ]);
      expect(yield* Ref.get(requestedCursors)).toEqual([
        null,
        "variant-cursor-1",
        "variant-cursor-2",
      ]);
    }),
  );

  it.effect("fails on GraphQL errors", () =>
    Effect.gen(function* () {
      const api = yield* ShopifyApiClient.ShopifyApiClient;
      const exit = yield* Effect.exit(api.fetchProducts({ first: 50 }));

      expect(exit._tag).toBe("Failure");
    }).pipe(
      Effect.provide(
        ShopifyApiClient.layerConfig(ShopifyConnector.ShopifyConfigDef.config).pipe(
          Layer.provide(staticAuthLayer),
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
