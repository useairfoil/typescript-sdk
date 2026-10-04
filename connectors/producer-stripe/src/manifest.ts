import * as Manifest from "@useairfoil/connector-kit/manifest";

export const StripeConfigDef = Manifest.defineConfig({
  apiKey: Manifest.secret({
    runtimeKey: "STRIPE_API_KEY",
    description: "Stripe restricted API key with read access to the synced resources and events.",
  }),
  webhookSecret: Manifest.secret({
    runtimeKey: "STRIPE_WEBHOOK_SECRET",
    description: "Signing secret of the Stripe webhook endpoint.",
  }),
  rateLimitPerSecond: Manifest.number({
    runtimeKey: "STRIPE_RATE_LIMIT_PER_SECOND",
    description: "Maximum Stripe API requests per second, shared by all resources.",
    default: 20,
    integer: true,
    minimum: 1,
  }),
});

export type StripeConfig = Manifest.ConfigValuesOf<typeof StripeConfigDef>;

export const manifest = Manifest.define({
  name: "producer-stripe",
  title: "Stripe",
  config: StripeConfigDef.spec,
  resources: [
    { name: "customers", capabilities: ["backfill", "changes", "webhook"] },
    { name: "products", capabilities: ["backfill", "changes", "webhook"] },
    { name: "prices", capabilities: ["backfill", "changes", "webhook"] },
    { name: "subscriptions", capabilities: ["backfill", "changes", "webhook"] },
    { name: "invoices", capabilities: ["backfill", "changes", "webhook"] },
    { name: "charges", capabilities: ["backfill", "changes", "webhook"] },
    { name: "refunds", capabilities: ["backfill", "changes", "webhook"] },
  ],
});
