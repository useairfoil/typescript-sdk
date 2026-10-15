import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";

import type { GitHubClientService } from "../client/client";
import type { RepositoryRef } from "../schemas/repositories";

import {
  IssueCommentDeletedEventSchema,
  IssueCommentEventSchema,
  WebhookPayloadSchema,
} from "../schemas/events";
import {
  type IssueComment,
  type IssueCommentObject,
  IssueCommentObjectSchema,
  IssueCommentSchema,
} from "../schemas/issue-comments";
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
  { updated_at, issue_url, ...rest }: IssueCommentObject,
  repository_id: bigint,
): IssueComment => ({
  ...rest,
  version: updated_at,
  repository_id,
  issue_number: numberAtEnd(issue_url),
});

export const issueCommentSpec: RepoResourceSpec<IssueCommentObject, IssueComment> = {
  path: "issues/comments",
  pageSchema: Schema.Array(IssueCommentObjectSchema),
  params: {},
  since: true,
  order: "sorted",
  ...timestamps,
  keep: () => true,
  enabled: (repository) => repository.has_issues || repository.has_pull_requests,
  rows: rowsOf(toRow),
};

export const makeIssueComments = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) =>
  Resource.entity({
    name: "issue_comments",
    rowSchema: IssueCommentSchema,
    version: "version",

    check: checkRepoResource(client, issueCommentSpec),
    backfill: backfillRepoResource(client, repositories, issueCommentSpec),
    changes: changesRepoResource(client, issueCommentSpec),
    webhook: {
      schema: WebhookPayloadSchema,
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const event = yield* decodeEvent(IssueCommentEventSchema, payload);
          if (Schema.is(IssueCommentDeletedEventSchema)(event)) {
            return [yield* deleteRow(event.comment.id)];
          }
          return [toRow(event.comment, event.repository.id)];
        }),
    },
  });
