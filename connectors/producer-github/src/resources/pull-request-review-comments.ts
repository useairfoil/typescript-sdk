import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";

import type { GitHubClientService } from "../client/client";
import type { RepositoryRef } from "../schemas/repositories";

import {
  PullRequestReviewCommentDeletedEventSchema,
  PullRequestReviewCommentEventSchema,
  WebhookPayloadSchema,
} from "../schemas/events";
import {
  type PullRequestReviewComment,
  type PullRequestReviewCommentObject,
  PullRequestReviewCommentObjectSchema,
  PullRequestReviewCommentSchema,
} from "../schemas/pull-request-review-comments";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  decodeEvent,
  deleteRow,
  numberAtEnd,
  rowsOf,
  timestamps,
} from "./shared";

const toRow = (
  { updated_at, pull_request_url, ...rest }: PullRequestReviewCommentObject,
  repository_id: bigint,
): PullRequestReviewComment => ({
  ...rest,
  version: updated_at,
  repository_id,
  pull_request_number: numberAtEnd(pull_request_url),
});

export const pullRequestReviewCommentSpec: RepoResourceSpec<
  PullRequestReviewCommentObject,
  PullRequestReviewComment
> = {
  path: "pulls/comments",
  pageSchema: Schema.Array(PullRequestReviewCommentObjectSchema),
  params: {},
  since: true,
  order: "sorted",
  ...timestamps,
  keep: () => true,
  enabled: (repository) => repository.has_pull_requests,
  rows: rowsOf(toRow),
};

export const makePullRequestReviewComments = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) =>
  Resource.entity({
    name: "pull_request_review_comments",
    rowSchema: PullRequestReviewCommentSchema,
    version: "version",

    check: checkRepoResource(client, pullRequestReviewCommentSpec),
    backfill: backfillRepoResource(client, repositories, pullRequestReviewCommentSpec),
    changes: changesRepoResource(client, pullRequestReviewCommentSpec),
    webhook: {
      schema: WebhookPayloadSchema,
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const event = yield* decodeEvent(PullRequestReviewCommentEventSchema, payload);
          if (Schema.is(PullRequestReviewCommentDeletedEventSchema)(event)) {
            return [yield* deleteRow(event.comment.id)];
          }
          return [toRow(event.comment, event.repository.id)];
        }),
    },
  });
