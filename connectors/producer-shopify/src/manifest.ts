import * as Manifest from "@useairfoil/connector-kit/manifest";

export const ShopifyConfigDef = Manifest.defineConfig({
  shopDomain: Manifest.string({
    runtimeKey: "SHOPIFY_SHOP_DOMAIN",
    description: "Shopify shop domain, for example example.myshopify.com.",
  }),
  apiVersion: Manifest.string({
    runtimeKey: "SHOPIFY_API_VERSION",
    description: "Shopify Admin API version used in GraphQL endpoint URLs.",
    default: "2026-07",
  }),
  clientId: Manifest.string({
    runtimeKey: "SHOPIFY_CLIENT_ID",
    description: "Client ID for the merchant-owned Shopify Dev Dashboard app.",
  }),
  clientSecret: Manifest.secret({
    runtimeKey: "SHOPIFY_CLIENT_SECRET",
    description: "Client secret for the merchant-owned Shopify Dev Dashboard app.",
  }),
  responseMaxRetries: Manifest.number({
    runtimeKey: "SHOPIFY_RESPONSE_MAX_RETRIES",
    description: "Maximum retries for temporary HTTP responses.",
    default: 5,
    integer: true,
    minimum: 0,
  }),
  transportMaxRetries: Manifest.number({
    runtimeKey: "SHOPIFY_TRANSPORT_MAX_RETRIES",
    description: "Maximum retries for connection and transport failures.",
    default: 5,
    integer: true,
    minimum: 0,
  }),
  graphqlMaxRetries: Manifest.number({
    runtimeKey: "SHOPIFY_GRAPHQL_MAX_RETRIES",
    description: "Maximum retries for temporary GraphQL errors.",
    default: 5,
    integer: true,
    minimum: 0,
  }),
  retryBaseDelayMs: Manifest.number({
    runtimeKey: "SHOPIFY_RETRY_BASE_DELAY_MS",
    description: "Initial delay for HTTP and transport retries.",
    default: 200,
    integer: true,
    minimum: 1,
  }),
  graphqlRetryBaseDelayMs: Manifest.number({
    runtimeKey: "SHOPIFY_GRAPHQL_RETRY_BASE_DELAY_MS",
    description: "Initial delay for temporary GraphQL errors.",
    default: 500,
    integer: true,
    minimum: 1,
  }),
  retryAfterFallbackSeconds: Manifest.number({
    runtimeKey: "SHOPIFY_RETRY_AFTER_FALLBACK_SECONDS",
    description: "Retry delay used when Shopify omits Retry-After.",
    default: 1,
    integer: true,
    minimum: 1,
  }),
  requestTimeoutSeconds: Manifest.number({
    runtimeKey: "SHOPIFY_REQUEST_TIMEOUT_SECONDS",
    description: "Maximum request time including retries.",
    default: 120,
    integer: true,
    minimum: 1,
  }),
  webhookSecret: Manifest.secret({
    runtimeKey: "SHOPIFY_WEBHOOK_SECRET",
    description: "Shopify webhook HMAC secret.",
  }),
});

export type ShopifyConfig = Manifest.ConfigValuesOf<typeof ShopifyConfigDef>;

export const manifest = Manifest.define({
  name: "producer-shopify",
  title: "Shopify",
  config: ShopifyConfigDef.spec,
  resources: [
    { name: "products", capabilities: ["backfill", "webhook"] },
    { name: "cart_events", capabilities: ["webhook"] },
  ],
});
