import * as Manifest from "@useairfoil/connector-kit/manifest";

export const ShopifyConfigDef = Manifest.defineConfig({
  shopDomain: Manifest.string({
    runtimeKey: "SHOPIFY_SHOP_DOMAIN",
    description: "Shopify shop domain, for example example.myshopify.com.",
  }),
  apiVersion: Manifest.string({
    runtimeKey: "SHOPIFY_API_VERSION",
    description: "Shopify Admin API version used in GraphQL endpoint URLs.",
    default: "2026-04",
  }),
  apiToken: Manifest.secret({
    runtimeKey: "SHOPIFY_API_TOKEN",
    description: "Shopify Admin API access token.",
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
