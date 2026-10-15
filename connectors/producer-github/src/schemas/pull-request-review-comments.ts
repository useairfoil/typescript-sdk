import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, deleted, field, user, version } from "./shared";

export const PullRequestReviewCommentSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique review comment ID.")),
  version: version(2, "review comment"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the review comment.")),
  repository_id: Long.pipe(field(4, "ID of the repository the comment belongs to.")),
  pull_request_number: Long.pipe(
    field(5, "Number of the pull request the comment is on, in its repository."),
  ),
  pull_request_review_id: Schema.NullOr(Long).pipe(
    field(6, "ID of the review the comment belongs to."),
  ),
  in_reply_to_id: Schema.optionalKey(Long).pipe(field(7, "ID of the comment this one replies to.")),
  user: Schema.NullOr(user(100)).pipe(field(8, "Account that wrote the comment.")),
  author_association: Schema.String.pipe(
    field(9, "Author's relation to the repository, such as OWNER or CONTRIBUTOR."),
  ),
  body: Schema.String.pipe(field(10, "Comment in Markdown.")),
  path: Schema.String.pipe(field(11, "Path of the file the comment is on.")),
  commit_id: Schema.String.pipe(field(12, "SHA of the commit the comment is on now.")),
  original_commit_id: Schema.String.pipe(
    field(13, "SHA of the commit the comment was written on."),
  ),
  diff_hunk: Schema.String.pipe(field(14, "Part of the diff the comment is on.")),
  // GitHub sends null for a comment on a line that is no longer in the diff.
  line: Schema.optionalKey(Schema.NullOr(Long)).pipe(
    field(15, "Last line of the commented range in the current diff."),
  ),
  original_line: Schema.optionalKey(Schema.NullOr(Long)).pipe(
    field(16, "Last line of the commented range in the original diff."),
  ),
  start_line: Schema.optionalKey(Schema.NullOr(Long)).pipe(
    field(17, "First line of a multi-line comment."),
  ),
  side: Schema.optionalKey(Schema.NullOr(Schema.String)).pipe(
    field(18, "Side of the diff: LEFT or RIGHT."),
  ),
  subject_type: Schema.optionalKey(Schema.String).pipe(
    field(19, "What the comment is on: line or file."),
  ),
  created_at: Timestamp.pipe(field(20, "Time the comment was written.")),
  html_url: Schema.String.pipe(field(21, "Comment on GitHub.")),
  _deleted: deleted(22, "review comment"),
})
  .annotate({
    description: "Review comments on pull request diffs.",
  })
  .pipe(Iceberg.identifier("id"));

export type PullRequestReviewComment = Schema.Schema.Type<typeof PullRequestReviewCommentSchema>;

export const PullRequestReviewCommentObjectSchema = PullRequestReviewCommentSchema.mapFields(
  (fields) => ({
    ...Struct.omit(fields, ["version", "repository_id", "pull_request_number", "_deleted"]),
    updated_at: Timestamp,
    // The list has no pull request number, only this URL, which ends in it.
    pull_request_url: Schema.String.check(Schema.isPattern(/\/pulls\/\d+$/)),
  }),
);

export type PullRequestReviewCommentObject = Schema.Schema.Type<
  typeof PullRequestReviewCommentObjectSchema
>;
