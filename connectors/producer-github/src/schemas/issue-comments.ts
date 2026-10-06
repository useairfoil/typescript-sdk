import { Schema, Struct } from "effect";

import { Long, Text, Timestamp, deleted, field, user, version } from "./shared";

export const IssueCommentSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique comment ID.")),
  version: version(2, "comment"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the comment.")),
  repository_id: Long.pipe(field(4, "ID of the repository the comment belongs to.")),
  issue_number: Long.pipe(
    field(5, "Number of the issue or pull request the comment is on, in its repository."),
  ),
  user: Schema.NullOr(user(100)).pipe(field(6, "Account that wrote the comment.")),
  author_association: Schema.String.pipe(
    field(7, "Author's relation to the repository, such as OWNER or CONTRIBUTOR."),
  ),
  body: Text.pipe(field(8, "Comment in Markdown. Empty when not set.")),
  created_at: Timestamp.pipe(field(9, "Time the comment was written.")),
  html_url: Schema.String.pipe(field(10, "Comment on GitHub.")),
  _deleted: deleted(11, "comment"),
}).annotate({
  description:
    "Comments on issues and pull requests. Pull request review comments are not included.",
});

export type IssueComment = Schema.Schema.Type<typeof IssueCommentSchema>;

export const IssueCommentObjectSchema = IssueCommentSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "repository_id", "issue_number", "_deleted"]),
  updated_at: Timestamp,
  // The list has no issue number, only this URL, which ends in it.
  issue_url: Schema.String.check(Schema.isPattern(/\/issues\/\d+$/)),
}));

export type IssueCommentObject = Schema.Schema.Type<typeof IssueCommentObjectSchema>;
