import * as Manifest from "@useairfoil/connector-kit/manifest";

export const ZendeskConfigDef = Manifest.defineConfig({
  subdomain: Manifest.string({
    runtimeKey: "ZENDESK_SUBDOMAIN",
    description: "Zendesk subdomain, for example acme for acme.zendesk.com.",
  }),
  clientId: Manifest.string({
    runtimeKey: "ZENDESK_CLIENT_ID",
    description: "Identifier of a confidential Zendesk OAuth client, created by an admin.",
  }),
  clientSecret: Manifest.secret({
    runtimeKey: "ZENDESK_CLIENT_SECRET",
    description: "Secret of the Zendesk OAuth client.",
  }),
});

export type ZendeskConfig = Manifest.ConfigValuesOf<typeof ZendeskConfigDef>;

const capabilities = ["backfill", "changes"] as const;

export const manifest = Manifest.define({
  name: "producer-zendesk",
  title: "Zendesk",
  config: ZendeskConfigDef.spec,
  resources: [
    { name: "tickets", capabilities },
    { name: "ticket_comments", capabilities },
    { name: "users", capabilities },
    { name: "organizations", capabilities },
    { name: "groups", capabilities },
    { name: "brands", capabilities },
    { name: "ticket_fields", capabilities },
    { name: "ticket_forms", capabilities },
    { name: "custom_statuses", capabilities },
    { name: "survey_responses", capabilities },
    { name: "csat_surveys", capabilities },
  ],
});
