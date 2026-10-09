import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";

import type { GitHubClientService } from "../client/client";
import type { RepositoryRef } from "../schemas/repositories";

import {
  IssueRemovedEventSchema,
  IssuesEventSchema,
  WebhookPayloadSchema,
} from "../schemas/events";
import { type Issue, type IssueObject, IssueObjectSchema, IssueSchema } from "../schemas/issues";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  decodeEvent,
  deleteRow,
} from "./shared";

const toRow = (
  { updated_at, labels, assignees, pull_request: _pullRequest, ...rest }: IssueObject,
  repository_id: bigint,
): Issue => ({
  ...rest,
  version: updated_at,
  repository_id,
  labels: labels ?? [],
  assignees: assignees ?? [],
});

// A webhook can leave a list out. Leave it out of the update too.
const toUpdate = (
  { updated_at, labels, assignees, pull_request: _pullRequest, ...rest }: IssueObject,
  repository_id: bigint,
) => ({
  ...rest,
  version: updated_at,
  repository_id,
  ...(labels === undefined ? {} : { labels }),
  ...(assignees === undefined ? {} : { assignees }),
});

export const issueSpec: RepoResourceSpec<IssueObject, Issue> = {
  path: "issues",
  itemSchema: IssueObjectSchema,
  params: { state: "all" },
  since: true,
  keep: (item) => item.pull_request === undefined,
  enabled: (repository) => repository.has_issues,
  toRow,
};

export const makeIssues = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) =>
  Resource.entity({
    name: "issues",
    rowSchema: IssueSchema,
    key: "id",
    version: "version",

    check: checkRepoResource(client, issueSpec),
    backfill: backfillRepoResource(client, repositories, issueSpec),
    changes: changesRepoResource(client, issueSpec),
    webhook: {
      schema: WebhookPayloadSchema,
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const event = yield* decodeEvent(IssuesEventSchema, payload);
          if (Schema.is(IssueRemovedEventSchema)(event)) return [yield* deleteRow(event.issue.id)];
          return [toUpdate(event.issue, event.repository.id)];
        }),
    },
  });
