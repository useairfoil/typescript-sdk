import { Schema, Struct } from "effect";

import {
  Long,
  Text,
  Timestamp,
  deleted,
  field,
  label,
  list,
  milestone,
  optionalList,
  user,
  version,
} from "./shared";

export const IssueSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique issue ID.")),
  version: version(2, "issue"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the issue.")),
  repository_id: Long.pipe(field(4, "ID of the repository the issue belongs to.")),
  number: Long.pipe(field(5, "Issue number in the repository.")),
  title: Schema.String.pipe(field(6, "Issue title.")),
  body: Text.pipe(field(7, "Issue description in Markdown. Empty when not set.")),
  state: Schema.String.pipe(field(8, "State: open or closed.")),
  state_reason: Schema.NullOr(Schema.String).pipe(
    field(9, "Why the issue was closed or reopened, such as completed or not_planned."),
  ),
  locked: Schema.Boolean.pipe(field(10, "Whether the conversation is locked.")),
  user: Schema.NullOr(user(100)).pipe(field(11, "Account that opened the issue.")),
  author_association: Schema.String.pipe(
    field(12, "Author's relation to the repository, such as OWNER or CONTRIBUTOR."),
  ),
  labels: list(103, label(104)).pipe(field(13, "Labels on the issue.")),
  assignees: list(106, user(107)).pipe(field(14, "Accounts assigned to the issue.")),
  milestone: Schema.NullOr(milestone(110)).pipe(
    field(15, "Milestone of the issue. Keeps the old value when the milestone is removed."),
  ),
  comments: Long.pipe(field(16, "Number of comments.")),
  created_at: Timestamp.pipe(field(17, "Time the issue was opened.")),
  closed_at: Schema.NullOr(Timestamp).pipe(
    field(18, "Time the issue was last closed. Keeps the old value when it is reopened."),
  ),
  html_url: Schema.String.pipe(field(19, "Issue page on GitHub.")),
  _deleted: deleted(20, "issue"),
}).annotate({
  description: "Issues in the installation's repositories. Pull requests are not included.",
});

export type Issue = Schema.Schema.Type<typeof IssueSchema>;

export const IssueObjectSchema = IssueSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "repository_id", "labels", "assignees", "_deleted"]),
  updated_at: Timestamp,
  labels: optionalList(label(104)),
  assignees: optionalList(user(107)),
  // Set on pull requests, which the issues list also returns.
  pull_request: Schema.optionalKey(Schema.Unknown),
}));

export type IssueObject = Schema.Schema.Type<typeof IssueObjectSchema>;
