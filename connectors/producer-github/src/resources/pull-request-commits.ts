import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";

import type { PullRequestObject } from "../schemas/pull-requests";
import type { RepositoryRef } from "../schemas/repositories";

import { type GitHubClientService, withParams } from "../client/client";
import { type CommitObject, CommitObjectSchema } from "../schemas/commits";
import { PullRequestCommitsEventSchema, WebhookPayloadSchema } from "../schemas/events";
import { type PullRequestCommit, PullRequestCommitSchema } from "../schemas/pull-request-commits";
import { pullRequestSpec } from "./pull-requests";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  childRows,
  decodeEvent,
  pageSize,
  readPages,
} from "./shared";

const toRow = (
  { sha, commit, author, committer, html_url }: CommitObject,
  pullRequest: { readonly number: bigint; readonly updated_at: Date },
  repository_id: bigint,
): PullRequestCommit => ({
  key: `${repository_id}:${pullRequest.number}:${sha}`,
  version: pullRequest.updated_at,
  repository_id,
  pull_request_number: pullRequest.number,
  sha,
  message: commit.message,
  author: commit.author,
  committer: commit.committer,
  author_user: author,
  committer_user: committer,
  html_url,
});

const commitsPath = (pullRequest: { readonly number: bigint }) =>
  `pulls/${pullRequest.number}/commits`;

const pullRequestCommitSpec = (
  client: GitHubClientService,
): RepoResourceSpec<PullRequestObject, PullRequestCommit> => ({
  ...pullRequestSpec,
  rows: childRows(client, {
    path: (pullRequest) => commitsPath(pullRequest),
    pageSchema: Schema.Array(CommitObjectSchema),
    toRow,
  }),
});

// Other actions don't change the commits. An edit does only when it changes the base.
const commitActions = new Set(["opened", "reopened", "synchronize"]);

export const makePullRequestCommits = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) => {
  const spec = pullRequestCommitSpec(client);
  return Resource.entity({
    name: "pull_request_commits",
    rowSchema: PullRequestCommitSchema,
    version: "version",

    check: checkRepoResource(client, spec),
    backfill: backfillRepoResource(client, repositories, spec),
    changes: changesRepoResource(client, spec),
    webhook: {
      schema: WebhookPayloadSchema,
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const { action, changes, repository, pull_request } = yield* decodeEvent(
            PullRequestCommitsEventSchema,
            payload,
          );
          if (!commitActions.has(action) && changes?.base === undefined) return [];
          const commits = yield* readPages(
            client,
            Schema.Array(CommitObjectSchema),
            withParams(`/repos/${repository.full_name}/${commitsPath(pull_request)}`, {
              per_page: pageSize,
            }),
          );
          return commits.map((commit) => toRow(commit, pull_request, repository.id));
        }),
    },
  });
};
