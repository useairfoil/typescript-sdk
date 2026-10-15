import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Duration, Effect } from "effect";

import type { GitHubClientService } from "../client/client";
import type { RepositoryRef } from "../schemas/repositories";

import { WebhookPayloadSchema, WorkflowRunEventSchema } from "../schemas/events";
import {
  type WorkflowRun,
  type WorkflowRunObject,
  WorkflowRunObjectSchema,
  WorkflowRunSchema,
} from "../schemas/workflow-runs";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  decodeEvent,
  rowsOf,
  timestamps,
  wrappedList,
} from "./shared";

const toRow = (
  { updated_at, pull_requests, ...rest }: WorkflowRunObject,
  repository_id: bigint,
): WorkflowRun => ({
  ...rest,
  version: updated_at,
  repository_id,
  pull_requests: pull_requests ?? [],
});

export const workflowRunSpec: RepoResourceSpec<WorkflowRunObject, WorkflowRun> = {
  path: "actions/runs",
  pageSchema: wrappedList("workflow_runs", WorkflowRunObjectSchema),
  // Filters cap the list at 1,000 runs, so none are used.
  params: {},
  since: false,
  order: "newest",
  // Most runs finish within a day. A later change, such as a re-run of an old
  // run, comes by webhook.
  recentFor: Duration.days(1),
  ...timestamps,
  keep: () => true,
  enabled: () => true,
  rows: rowsOf(toRow),
};

export const makeWorkflowRuns = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) =>
  Resource.entity({
    name: "workflow_runs",
    rowSchema: WorkflowRunSchema,
    version: "version",

    check: checkRepoResource(client, workflowRunSpec),
    backfill: backfillRepoResource(client, repositories, workflowRunSpec),
    changes: changesRepoResource(client, workflowRunSpec),
    webhook: {
      schema: WebhookPayloadSchema,
      handler: ({ payload }) =>
        decodeEvent(WorkflowRunEventSchema, payload).pipe(
          Effect.map((event) => [toRow(event.workflow_run, event.repository.id)]),
        ),
    },
  });
