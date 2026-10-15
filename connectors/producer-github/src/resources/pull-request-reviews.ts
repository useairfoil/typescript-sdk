import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { DateTime, Effect, Schema } from "effect";

import type { GitHubClientService } from "../client/client";
import type { PullRequestObject } from "../schemas/pull-requests";
import type { RepositoryRef } from "../schemas/repositories";

import { PullRequestReviewEventSchema, WebhookPayloadSchema } from "../schemas/events";
import {
  type PullRequestReview,
  type PullRequestReviewObject,
  PullRequestReviewObjectSchema,
  PullRequestReviewSchema,
} from "../schemas/pull-request-reviews";
import { pullRequestSpec } from "./pull-requests";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  childRows,
  decodeEvent,
} from "./shared";

const toRow = (
  review: PullRequestReviewObject,
  pull_request_number: bigint,
  repository_id: bigint,
  version: Date,
): PullRequestReview => ({ ...review, version, repository_id, pull_request_number });

/** A review bumps its pull request's update time, so changes follow pull requests. */
const reviewSpec = (
  client: GitHubClientService,
): RepoResourceSpec<PullRequestObject, PullRequestReview> => ({
  ...pullRequestSpec,
  rows: childRows(client, {
    path: (pullRequest) => `pulls/${pullRequest.number}/reviews`,
    pageSchema: Schema.Array(PullRequestReviewObjectSchema),
    toRow: (review, pullRequest, repositoryId, readAt) =>
      toRow(review, pullRequest.number, repositoryId, readAt),
  }),
});

export const makePullRequestReviews = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) => {
  const spec = reviewSpec(client);
  return Resource.entity({
    name: "pull_request_reviews",
    rowSchema: PullRequestReviewSchema,
    version: "version",

    check: checkRepoResource(client, spec),
    backfill: backfillRepoResource(client, repositories, spec),
    changes: changesRepoResource(client, spec),
    webhook: {
      schema: WebhookPayloadSchema,
      // No update time, so read the latest state instead of trusting the payload.
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const { repository, pull_request, review } = yield* decodeEvent(
            PullRequestReviewEventSchema,
            payload,
          );
          const readAt = yield* DateTime.nowAsDate;
          const page = yield* client.get(
            PullRequestReviewObjectSchema,
            `/repos/${repository.full_name}/pulls/${pull_request.number}/reviews/${review.id}`,
          );
          return [toRow(page.body, pull_request.number, repository.id, readAt)];
        }),
    },
  });
};
