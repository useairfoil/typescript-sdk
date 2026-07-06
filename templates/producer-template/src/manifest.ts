import * as Manifest from "@useairfoil/connector-kit/manifest";

export const TemplateConfigDef = Manifest.defineConfig({
  apiBaseUrl: Manifest.string({
    env: "TEMPLATE_API_BASE_URL",
    description: "Template API base URL.",
    default: "https://jsonplaceholder.typicode.com",
  }),
  apiToken: Manifest.optional(
    Manifest.secret({
      env: "TEMPLATE_API_TOKEN",
      description: "Optional template API bearer token.",
    }),
  ),
  webhookSecret: Manifest.optional(
    Manifest.secret({
      env: "TEMPLATE_WEBHOOK_SECRET",
      description: "Optional template webhook signing secret.",
    }),
  ),
});

export type TemplateConfig = Manifest.ConfigValuesOf<typeof TemplateConfigDef>;

export const manifest = Manifest.define({
  name: "producer-template",
  title: "Producer Template",
  config: TemplateConfigDef.spec,
  resources: [{ name: "posts", capabilities: ["backfill", "webhook"] }],
});
