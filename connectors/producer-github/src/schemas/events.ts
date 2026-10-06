import { Schema } from "effect";

import { IssueCommentObjectSchema } from "./issue-comments";
import { IssueObjectSchema } from "./issues";
import { PullRequestObjectSchema } from "./pull-requests";
import { RepositoryObjectSchema } from "./repositories";
import { ObjectRefSchema } from "./shared";

/**
 * The webhook route passes the payload on as it is. GitHub puts the event name
 * in a header, so each resource decodes its own event.
 */
export const WebhookPayloadSchema = Schema.Record(Schema.String, Schema.Unknown);

export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;

export const InstallationEventSchema = Schema.Struct({
  installation: Schema.optional(Schema.Struct({ id: Schema.Number })),
});

/** A transferred issue no longer exists in its old repository. */
export const IssueRemovedEventSchema = Schema.Struct({
  action: Schema.Literals(["deleted", "transferred"]),
  issue: ObjectRefSchema,
});

export const IssuesEventSchema = Schema.Union([
  IssueRemovedEventSchema,
  Schema.Struct({
    action: Schema.String,
    repository: ObjectRefSchema,
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

export const PullRequestEventSchema = Schema.Struct({
  repository: ObjectRefSchema,
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
