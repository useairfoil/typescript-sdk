import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { DateTime, Effect } from "effect";

import type { GitHubClientService } from "../client/client";
import type { RepositoryRef } from "../schemas/repositories";
import type { WorkflowRunObject } from "../schemas/workflow-runs";

import { WebhookPayloadSchema, WorkflowJobEventSchema } from "../schemas/events";
import {
  type WorkflowJob,
  type WorkflowJobObject,
  WorkflowJobObjectSchema,
  WorkflowJobSchema,
} from "../schemas/workflow-jobs";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  childRows,
  decodeEvent,
  wrappedList,
} from "./shared";
import { workflowRunSpec } from "./workflow-runs";

const toRow = (
  { steps, ...rest }: WorkflowJobObject,
  repository_id: bigint,
  version: Date,
): WorkflowJob => ({ ...rest, version, repository_id, steps: steps ?? [] });

const workflowJobSpec = (
  client: GitHubClientService,
): RepoResourceSpec<WorkflowRunObject, WorkflowJob> => ({
  ...workflowRunSpec,
  rows: childRows(client, {
    path: (run) => `actions/runs/${run.id}/jobs`,
    pageSchema: wrappedList("jobs", WorkflowJobObjectSchema),
    // Earlier attempts' jobs too, so a re-run keeps the history.
    params: { filter: "all" },
    toRow: (job, _run, repositoryId, readAt) => toRow(job, repositoryId, readAt),
  }),
});

export const makeWorkflowJobs = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) => {
  const spec = workflowJobSpec(client);
  return Resource.entity({
    name: "workflow_jobs",
    rowSchema: WorkflowJobSchema,
    version: "version",

    check: checkRepoResource(client, spec),
    backfill: backfillRepoResource(client, repositories, spec),
    changes: changesRepoResource(client, spec),
    webhook: {
      schema: WebhookPayloadSchema,
      // No update time, so read the latest state instead of trusting the payload.
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const { repository, workflow_job } = yield* decodeEvent(WorkflowJobEventSchema, payload);
          const readAt = yield* DateTime.nowAsDate;
          const page = yield* client.get(
            WorkflowJobObjectSchema,
            `/repos/${repository.full_name}/actions/jobs/${workflow_job.id}`,
          );
          return [toRow(page.body, repository.id, readAt)];
        }),
    },
  });
};
