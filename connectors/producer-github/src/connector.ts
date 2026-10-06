import { Connector, type ResourceDefinition } from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Redacted } from "effect";

import type { GitHubConfig } from "./manifest";

import * as GitHubClient from "./client/client";
import { makeIssueComments } from "./resources/issue-comments";
import { makeIssues } from "./resources/issues";
import { makePullRequests } from "./resources/pull-requests";
import { makeRepositories } from "./resources/repositories";
import { cachedRepositoryRefs } from "./resources/shared";
import { makeWebhookRoute } from "./webhook/route";
export { GitHubConfigDef, manifest } from "./manifest";
export type { GitHubConfig } from "./manifest";

export const make = Effect.fnUntraced(function* (config: GitHubConfig) {
  const client = yield* GitHubClient.GitHubClient;
  // The backfills of the per-repository resources share this list.
  const repositories = yield* cachedRepositoryRefs(client);

  const Repositories = makeRepositories(client);
  const Issues = makeIssues(client, repositories);
  const PullRequests = makePullRequests(client, repositories);
  const IssueComments = makeIssueComments(client, repositories);

  return Connector.define({
    name: "producer-github",
    title: "GitHub",
    resources: [Repositories, Issues, PullRequests, IssueComments],
    webhooks: [
      makeWebhookRoute({
        secret: Redacted.value(config.webhookSecret),
        installationId: config.installationId,
        targets: new Map<string, ResourceDefinition>([
          ["repository", Repositories],
          ["issues", Issues],
          ["pull_request", PullRequests],
          ["issue_comment", IssueComments],
        ]),
      }),
    ],
  });
});

export type GitHubConnectorRuntime = Effect.Success<ReturnType<typeof make>>;

export class GitHubConnector extends Context.Service<GitHubConnector, GitHubConnectorRuntime>()(
  "@useairfoil/producer-github/GitHubConnector",
) {}

export const layer = (config: GitHubConfig) =>
  Layer.effect(GitHubConnector)(
    make(config).pipe(Effect.annotateLogs({ component: "github" })),
  ).pipe(Layer.provide(GitHubClient.layer(config)));

export const layerConfig = (config: Config.Wrap<GitHubConfig>) =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
