import { ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Array as Arr, Effect, Schema } from "effect";

import type { CommitObject } from "../schemas/commits";
import type { RepositoryRef } from "../schemas/repositories";

import { type GitHubClientService, withParams } from "../client/client";
import {
  type CommitStatus,
  type CommitStatusObject,
  CommitStatusObjectSchema,
  CommitStatusSchema,
} from "../schemas/commit-statuses";
import { StatusEventSchema, WebhookPayloadSchema } from "../schemas/events";
import { commitSpec } from "./commits";
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
  { updated_at, ...rest }: CommitStatusObject,
  sha: string,
  repository_id: bigint,
): CommitStatus => ({ ...rest, version: updated_at, repository_id, sha });

/** Statuses of default-branch commits. Webhooks also bring other branches. */
const commitStatusSpec = (
  client: GitHubClientService,
): RepoResourceSpec<CommitObject, CommitStatus> => ({
  ...commitSpec,
  rows: childRows(client, {
    path: (commit) => `commits/${commit.sha}/statuses`,
    pageSchema: Schema.Array(CommitStatusObjectSchema),
    toRow: (status, commit, repositoryId) => toRow(status, commit.sha, repositoryId),
  }),
});

export const makeCommitStatuses = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) => {
  const spec = commitStatusSpec(client);
  return Resource.entity({
    name: "commit_statuses",
    rowSchema: CommitStatusSchema,
    version: "version",

    check: checkRepoResource(client, spec),
    backfill: backfillRepoResource(client, repositories, spec),
    changes: changesRepoResource(client, spec),
    webhook: {
      schema: WebhookPayloadSchema,
      // The payload has no node ID or creator, so read the status from the list.
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const { id, sha, repository } = yield* decodeEvent(StatusEventSchema, payload);
          const isStatus = (status: CommitStatusObject) => status.id === id;
          const status = yield* readPages(
            client,
            Schema.Array(CommitStatusObjectSchema),
            withParams(`/repos/${repository.full_name}/commits/${sha}/statuses`, {
              per_page: pageSize,
            }),
            (page) => !page.some(isStatus),
          ).pipe(
            Effect.flatMap((statuses) =>
              Effect.fromOption(
                Arr.findFirst(statuses, isStatus),
                () => new ConnectorError({ message: `Commit status ${id} is not in the list` }),
              ),
            ),
          );
          return [toRow(status, sha, repository.id)];
        }),
    },
  });
};
