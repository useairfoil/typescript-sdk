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
  webhookSecret: Manifest.optional(
    Manifest.secret({
      runtimeKey: "POLAR_WEBHOOK_SECRET",
      description: "Optional Polar webhook signing secret.",
    }),
  ),
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
