import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import type { GitHubClientService } from "../client/client";
import type { RepositoryRef } from "../schemas/repositories";

import { PullRequestEventSchema, WebhookPayloadSchema } from "../schemas/events";
import {
  type PullRequest,
  type PullRequestObject,
  PullRequestObjectSchema,
  PullRequestSchema,
} from "../schemas/pull-requests";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  decodeEvent,
} from "./shared";

const toRow = (
  { updated_at, labels, assignees, requested_reviewers, ...rest }: PullRequestObject,
  repository_id: bigint,
): PullRequest => ({
  ...rest,
  version: updated_at,
  repository_id,
  labels: labels ?? [],
  assignees: assignees ?? [],
  requested_reviewers: requested_reviewers ?? [],
});

// A webhook can leave a list out. Leave it out of the update too.
const toUpdate = (
  { updated_at, labels, assignees, requested_reviewers, ...rest }: PullRequestObject,
  repository_id: bigint,
) => ({
  ...rest,
  version: updated_at,
  repository_id,
  ...(labels === undefined ? {} : { labels }),
  ...(assignees === undefined ? {} : { assignees }),
  ...(requested_reviewers === undefined ? {} : { requested_reviewers }),
});

export const pullRequestSpec: RepoResourceSpec<PullRequestObject, PullRequest> = {
  path: "pulls",
  itemSchema: PullRequestObjectSchema,
  params: { state: "all" },
  // The pulls list has no `since`.
  since: false,
  keep: () => true,
  enabled: (repository) => repository.has_pull_requests !== false,
  toRow,
};

export const makePullRequests = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) =>
  Resource.entity({
    name: "pull_requests",
    rowSchema: PullRequestSchema,
    key: "id",
    version: "version",

    check: checkRepoResource(client, pullRequestSpec),
    backfill: backfillRepoResource(client, repositories, pullRequestSpec),
    changes: changesRepoResource(client, pullRequestSpec),
    webhook: {
      schema: WebhookPayloadSchema,
      handler: ({ payload }) =>
        decodeEvent(PullRequestEventSchema, payload).pipe(
          Effect.map((event) => [toUpdate(event.pull_request, event.repository.id)]),
        ),
    },
  });
