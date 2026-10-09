import { Schema, Struct } from "effect";

import {
  Long,
  Text,
  Timestamp,
  field,
  label,
  list,
  milestone,
  optionalList,
  user,
  version,
} from "./shared";

const branch = (baseId: number) =>
  Schema.Struct({
    ref: Schema.String.pipe(field(baseId, "Branch name.")),
    sha: Schema.String.pipe(field(baseId + 1, "Commit SHA.")),
    label: Schema.String.pipe(field(baseId + 2, "Owner and branch, such as octocat:main.")),
  });

export const PullRequestSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique pull request ID. Not the ID of its issue.")),
  version: version(2, "pull request"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the pull request.")),
  repository_id: Long.pipe(field(4, "ID of the repository the pull request belongs to.")),
  number: Long.pipe(field(5, "Pull request number in the repository.")),
  title: Schema.String.pipe(field(6, "Pull request title.")),
  body: Text.pipe(field(7, "Pull request description in Markdown. Empty when not set.")),
  state: Schema.String.pipe(field(8, "State: open or closed. Merged pull requests are closed.")),
  draft: Schema.optionalKey(Schema.Boolean).pipe(field(9, "Whether the pull request is a draft.")),
  locked: Schema.Boolean.pipe(field(10, "Whether the conversation is locked.")),
  user: Schema.NullOr(user(100)).pipe(field(11, "Account that opened the pull request.")),
  author_association: Schema.String.pipe(
    field(12, "Author's relation to the repository, such as OWNER or CONTRIBUTOR."),
  ),
  labels: list(103, label(104)).pipe(field(13, "Labels on the pull request.")),
  assignees: list(106, user(107)).pipe(field(14, "Accounts assigned to the pull request.")),
  requested_reviewers: list(110, user(111)).pipe(
    field(15, "Accounts asked to review that have not reviewed yet."),
  ),
  milestone: Schema.NullOr(milestone(114)).pipe(
    field(16, "Milestone of the pull request. Keeps the old value when it is removed."),
  ),
  head: branch(117).pipe(field(17, "Branch the changes come from.")),
  base: branch(120).pipe(field(18, "Branch the changes merge into.")),
  created_at: Timestamp.pipe(field(19, "Time the pull request was opened.")),
  closed_at: Schema.NullOr(Timestamp).pipe(
    field(20, "Time the pull request was last closed. Keeps the old value when it is reopened."),
  ),
  merged_at: Schema.NullOr(Timestamp).pipe(field(21, "Time the pull request was merged.")),
  html_url: Schema.String.pipe(field(22, "Pull request page on GitHub.")),
}).annotate({
  description: "Pull requests in the installation's repositories.",
});

export type PullRequest = Schema.Schema.Type<typeof PullRequestSchema>;

export const PullRequestObjectSchema = PullRequestSchema.mapFields((fields) => ({
  ...Struct.omit(fields, [
    "version",
    "repository_id",
    "labels",
    "assignees",
    "requested_reviewers",
  ]),
  updated_at: Timestamp,
  labels: optionalList(label(104)),
  assignees: optionalList(user(107)),
  requested_reviewers: optionalList(user(111)),
}));

export type PullRequestObject = Schema.Schema.Type<typeof PullRequestObjectSchema>;
