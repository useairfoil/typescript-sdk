import { Schema, Struct } from "effect";

import { IssueCommentObjectSchema } from "./issue-comments";
import { IssueObjectSchema } from "./issues";
import { PullRequestReviewCommentObjectSchema } from "./pull-request-review-comments";
import { PullRequestObjectSchema } from "./pull-requests";
import { ReleaseObjectSchema } from "./releases";
import { RepositoryObjectSchema } from "./repositories";
import { Long, ObjectRefSchema, Timestamp } from "./shared";
import { WorkflowRunObjectSchema } from "./workflow-runs";

/**
 * The webhook route passes the payload on as it is. GitHub puts the event name
 * in a header, so each resource decodes its own event.
 */
export const WebhookPayloadSchema = Schema.Record(Schema.String, Schema.Unknown);

export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;

export const InstallationEventSchema = Schema.Struct({
  installation: Schema.optional(Schema.Struct({ id: Schema.Number })),
});

/** For handlers that read the API again. */
const RepositoryNameSchema = Schema.Struct({ id: Long, full_name: Schema.String });

/** A transferred issue no longer exists in its old repository. */
export const IssueRemovedEventSchema = Schema.Struct({
  action: Schema.Literals(["deleted", "transferred"]),
  issue: ObjectRefSchema,
});

export const IssuesEventSchema = Schema.Union([
  IssueRemovedEventSchema,
  Schema.Struct({
    action: Schema.String,
    repository: RepositoryNameSchema,
    issue: IssueObjectSchema,
  }),
]);

export const IssueCommentDeletedEventSchema = Schema.Struct({
  action: Schema.Literal("deleted"),
  comment: ObjectRefSchema,
});

export const IssueCommentEventSchema = Schema.Union([
  IssueCommentDeletedEventSchema,
  Schema.Struct({
    action: Schema.String,
    repository: ObjectRefSchema,
    comment: IssueCommentObjectSchema,
  }),
]);

export const PullRequestReviewCommentDeletedEventSchema = Schema.Struct({
  action: Schema.Literal("deleted"),
  comment: ObjectRefSchema,
});

export const PullRequestReviewCommentEventSchema = Schema.Union([
  PullRequestReviewCommentDeletedEventSchema,
  Schema.Struct({
    action: Schema.String,
    repository: ObjectRefSchema,
    comment: PullRequestReviewCommentObjectSchema,
  }),
]);

export const PullRequestEventSchema = Schema.Struct({
  repository: RepositoryNameSchema,
  pull_request: PullRequestObjectSchema,
});

export const RepositoryDeletedEventSchema = Schema.Struct({
  action: Schema.Literal("deleted"),
  repository: ObjectRefSchema,
});

export const RepositoryEventSchema = Schema.Union([
  RepositoryDeletedEventSchema,
  Schema.Struct({ action: Schema.String, repository: RepositoryObjectSchema }),
]);

export const ReleaseDeletedEventSchema = Schema.Struct({
  action: Schema.Literal("deleted"),
  release: ObjectRefSchema,
});

export const ReleaseEventSchema = Schema.Union([
  ReleaseDeletedEventSchema,
  Schema.Struct({
    action: Schema.String,
    repository: ObjectRefSchema,
    release: ReleaseObjectSchema,
  }),
]);

export const WorkflowRunEventSchema = Schema.Struct({
  repository: ObjectRefSchema,
  workflow_run: WorkflowRunObjectSchema,
});

export const PushEventSchema = Schema.Struct({
  ref: Schema.String,
  before: Schema.String,
  after: Schema.String,
  repository: RepositoryNameSchema.mapFields(Struct.assign({ default_branch: Schema.String })),
});

export const PullRequestReviewEventSchema = Schema.Struct({
  repository: RepositoryNameSchema,
  pull_request: Schema.Struct({ number: Long }),
  review: ObjectRefSchema,
});

export const PullRequestCommitsEventSchema = Schema.Struct({
  action: Schema.String,
  changes: Schema.optionalKey(Schema.Struct({ base: Schema.optionalKey(Schema.Unknown) })),
  repository: RepositoryNameSchema,
  pull_request: Schema.Struct({ number: Long, updated_at: Timestamp }),
});

export const CheckRunEventSchema = Schema.Struct({
  repository: RepositoryNameSchema,
  check_run: ObjectRefSchema,
});

export const WorkflowJobEventSchema = Schema.Struct({
  repository: RepositoryNameSchema,
  workflow_job: ObjectRefSchema,
});

/** The status payload is flat. */
export const StatusEventSchema = Schema.Struct({
  id: Long,
  sha: Schema.String,
  repository: RepositoryNameSchema,
});
