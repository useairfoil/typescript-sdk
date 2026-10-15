import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { DateTime, Effect } from "effect";

import type { GitHubClientService } from "../client/client";
import type { CommitObject } from "../schemas/commits";
import type { RepositoryRef } from "../schemas/repositories";

import {
  type CheckRun,
  type CheckRunObject,
  CheckRunObjectSchema,
  CheckRunSchema,
} from "../schemas/check-runs";
import { CheckRunEventSchema, WebhookPayloadSchema } from "../schemas/events";
import { commitSpec } from "./commits";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  childRows,
  decodeEvent,
  wrappedList,
} from "./shared";

const toRow = (checkRun: CheckRunObject, repository_id: bigint, version: Date): CheckRun => ({
  ...checkRun,
  version,
  repository_id,
});

/** Check runs of default-branch commits. Webhooks also bring other branches. */
const checkRunSpec = (client: GitHubClientService): RepoResourceSpec<CommitObject, CheckRun> => ({
  ...commitSpec,
  rows: childRows(client, {
    path: (commit) => `commits/${commit.sha}/check-runs`,
    pageSchema: wrappedList("check_runs", CheckRunObjectSchema),
    // Without it, a re-run hides the earlier runs.
    params: { filter: "all" },
    toRow: (checkRun, _commit, repositoryId, readAt) => toRow(checkRun, repositoryId, readAt),
  }),
});

export const makeCheckRuns = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) => {
  const spec = checkRunSpec(client);
  return Resource.entity({
    name: "check_runs",
    rowSchema: CheckRunSchema,
    version: "version",

    check: checkRepoResource(client, spec),
    backfill: backfillRepoResource(client, repositories, spec),
    changes: changesRepoResource(client, spec),
    webhook: {
      schema: WebhookPayloadSchema,
      // No update time, so read the latest state instead of trusting the payload.
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const { repository, check_run } = yield* decodeEvent(CheckRunEventSchema, payload);
          const readAt = yield* DateTime.nowAsDate;
          const page = yield* client.get(
            CheckRunObjectSchema,
            `/repos/${repository.full_name}/check-runs/${check_run.id}`,
          );
          return [toRow(page.body, repository.id, readAt)];
        }),
    },
  });
};
