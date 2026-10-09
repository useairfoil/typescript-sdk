import * as Manifest from "@useairfoil/connector-kit/manifest";

export const GitHubConfigDef = Manifest.defineConfig({
  appClientId: Manifest.string({
    runtimeKey: "GITHUB_APP_CLIENT_ID",
    description: "Client ID of the GitHub App, for example Iv23li...",
  }),
  appPrivateKey: Manifest.secret({
    runtimeKey: "GITHUB_APP_PRIVATE_KEY",
    description: "PEM private key of the GitHub App. Newlines may be written as \\n.",
  }),
  installationId: Manifest.number({
    runtimeKey: "GITHUB_INSTALLATION_ID",
    description: "ID of the GitHub App installation to sync.",
    integer: true,
    minimum: 1,
  }),
  webhookSecret: Manifest.secret({
    runtimeKey: "GITHUB_WEBHOOK_SECRET",
    description: "Webhook secret of the GitHub App.",
  }),
});

export type GitHubConfig = Manifest.ConfigValuesOf<typeof GitHubConfigDef>;

export const manifest = Manifest.define({
  name: "producer-github",
  title: "GitHub",
  config: GitHubConfigDef.spec,
  resources: [
    { name: "repositories", capabilities: ["backfill", "changes", "webhook"] },
    { name: "issues", capabilities: ["backfill", "changes", "webhook"] },
    { name: "pull_requests", capabilities: ["backfill", "changes", "webhook"] },
    { name: "issue_comments", capabilities: ["backfill", "changes", "webhook"] },
  ],
});
