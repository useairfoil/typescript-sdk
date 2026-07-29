import * as Manifest from "@useairfoil/connector-kit/manifest";

export const PolarConfigDef = Manifest.defineConfig({
  accessToken: Manifest.secret({
    runtimeKey: "POLAR_ACCESS_TOKEN",
    description: "Polar organization access token used for REST API requests.",
  }),
  apiBaseUrl: Manifest.string({
    runtimeKey: "POLAR_API_BASE_URL",
    description: "Polar API base URL, including the /v1 path.",
  }),
  organizationId: Manifest.optional(
    Manifest.string({
      runtimeKey: "POLAR_ORGANIZATION_ID",
      description: "Optional Polar organization ID filter for list endpoints.",
    }),
  ),
  rateLimitPerMinute: Manifest.optional(
    Manifest.number({
      runtimeKey: "POLAR_RATE_LIMIT_PER_MINUTE",
      description: "Optional request limit per minute. Defaults to the Polar environment limit.",
      integer: true,
      minimum: 1,
    }),
  ),
  transientMaxRetries: Manifest.number({
    runtimeKey: "POLAR_TRANSIENT_MAX_RETRIES",
    description: "Maximum retries for temporary Polar failures.",
    default: 5,
    integer: true,
    minimum: 0,
  }),
  retryBaseDelayMs: Manifest.number({
    runtimeKey: "POLAR_RETRY_BASE_DELAY_MS",
    description: "Initial retry delay for temporary Polar failures.",
    default: 200,
    integer: true,
    minimum: 1,
  }),
  requestTimeoutSeconds: Manifest.number({
    runtimeKey: "POLAR_REQUEST_TIMEOUT_SECONDS",
    description: "Maximum request time including retries.",
    default: 120,
    integer: true,
    minimum: 1,
  }),
  webhookSecret: Manifest.secret({
    runtimeKey: "POLAR_WEBHOOK_SECRET",
    description: "Polar webhook signing secret.",
  }),
});

export type PolarConfig = Manifest.ConfigValuesOf<typeof PolarConfigDef>;

export const manifest = Manifest.define({
  name: "producer-polar",
  title: "Polar",
  config: PolarConfigDef.spec,
  resources: [
    { name: "customers", capabilities: ["backfill", "webhook"] },
    { name: "checkouts", capabilities: ["backfill", "webhook"] },
    { name: "orders", capabilities: ["backfill", "webhook"] },
    { name: "subscriptions", capabilities: ["backfill", "webhook"] },
  ],
});
