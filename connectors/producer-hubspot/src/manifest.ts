import * as Manifest from "@useairfoil/connector-kit/manifest";

export const HubSpotConfigDef = Manifest.defineConfig({
  accessToken: Manifest.secret({
    runtimeKey: "HUBSPOT_ACCESS_TOKEN",
    description: "HubSpot service key or static app token with read access to the synced objects.",
  }),
  clientSecret: Manifest.optional(
    Manifest.secret({
      runtimeKey: "HUBSPOT_CLIENT_SECRET",
      description: "Client secret of the HubSpot app that sends webhooks. Turns on webhooks.",
    }),
  ),
});

export type HubSpotConfig = Manifest.ConfigValuesOf<typeof HubSpotConfigDef>;

const crmCapabilities = ["backfill", "changes", "webhook"] as const;

export const manifest = Manifest.define({
  name: "producer-hubspot",
  title: "HubSpot",
  config: HubSpotConfigDef.spec,
  resources: [
    { name: "contacts", capabilities: crmCapabilities },
    { name: "companies", capabilities: crmCapabilities },
    { name: "deals", capabilities: crmCapabilities },
    { name: "tickets", capabilities: crmCapabilities },
    { name: "calls", capabilities: crmCapabilities },
    { name: "emails", capabilities: crmCapabilities },
    { name: "meetings", capabilities: crmCapabilities },
    { name: "notes", capabilities: crmCapabilities },
    { name: "tasks", capabilities: crmCapabilities },
    { name: "line_items", capabilities: crmCapabilities },
    { name: "products", capabilities: crmCapabilities },
    { name: "owners", capabilities: ["backfill", "changes"] },
    { name: "pipelines", capabilities: ["backfill", "changes"] },
  ],
});
