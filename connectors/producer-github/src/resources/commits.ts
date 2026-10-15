import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";

import type { RepositoryRef } from "../schemas/repositories";

import { type GitHubClientService, withParams } from "../client/client";
import {
  type Commit,
  type CommitObject,
  CommitObjectSchema,
  CommitSchema,
} from "../schemas/commits";
import { PushEventSchema, WebhookPayloadSchema } from "../schemas/events";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  decodeEvent,
  pageSize,
  readPages,
  rowsOf,
  wrappedList,
} from "./shared";

const toRow = (
  { sha, node_id, commit, author, committer, parents, html_url }: CommitObject,
  repository_id: bigint,
): Commit => ({
  key: `${repository_id}:${sha}`,
  version: commit.committer.date,
  repository_id,
  sha,
  node_id,
  message: commit.message,
  author: commit.author,
  committer: commit.committer,
  author_user: author,
  committer_user: committer,
  parents: parents.map((parent) => parent.sha),
  verified: commit.verification?.verified ?? false,
  html_url,
});

const committedAt = (item: CommitObject) => item.commit.committer.date;

/** The list only has the default branch. */
export const commitSpec: RepoResourceSpec<CommitObject, Commit> = {
  path: "commits",
  pageSchema: Schema.Array(CommitObjectSchema),
  params: {},
  // `since` filters on the commit time, not the push time. Pushes of older
  // commits come by webhook.
  since: true,
  order: "newest",
  createdAt: committedAt,
  updatedAt: committedAt,
  keep: () => true,
  enabled: (repository) => repository.size > 0,
  rows: rowsOf(toRow),
};

const noCommit = /^0+$/;

export const makeCommits = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) =>
  Resource.entity({
    name: "commits",
    rowSchema: CommitSchema,
    version: "version",

    check: checkRepoResource(client, commitSpec),
    backfill: backfillRepoResource(client, repositories, commitSpec),
    changes: changesRepoResource(client, commitSpec),
    webhook: {
      schema: WebhookPayloadSchema,
      // The push payload is not the API's commit, so the commits are read from
      // the compare API. A new or deleted branch has nothing to compare.
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const { ref, before, after, repository } = yield* decodeEvent(PushEventSchema, payload);
          if (
            ref !== `refs/heads/${repository.default_branch}` ||
            noCommit.test(before) ||
            noCommit.test(after)
          ) {
            return [];
          }
          const commits = yield* readPages(
            client,
            wrappedList("commits", CommitObjectSchema),
            withParams(`/repos/${repository.full_name}/compare/${before}...${after}`, {
              per_page: pageSize,
            }),
          );
          return commits.map((commit) => toRow(commit, repository.id));
        }),
    },
  });
