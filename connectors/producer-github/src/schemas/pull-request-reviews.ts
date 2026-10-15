import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, field, readVersion, user } from "./shared";

export const PullRequestReviewSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique review ID.")),
  version: readVersion(2, "review"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the review.")),
  repository_id: Long.pipe(field(4, "ID of the repository the review belongs to.")),
  pull_request_number: Long.pipe(
    field(5, "Number of the pull request the review is on, in its repository."),
  ),
  user: Schema.NullOr(user(100)).pipe(field(6, "Account that wrote the review.")),
  author_association: Schema.String.pipe(
    field(7, "Author's relation to the repository, such as OWNER or CONTRIBUTOR."),
  ),
  state: Schema.String.pipe(
    field(8, "State, such as APPROVED, CHANGES_REQUESTED, COMMENTED, or DISMISSED."),
  ),
  body: Schema.String.pipe(field(9, "Review summary in Markdown.")),
  commit_id: Schema.NullOr(Schema.String).pipe(field(10, "SHA of the commit the review is on.")),
  submitted_at: Schema.optionalKey(Timestamp).pipe(field(11, "Time the review was submitted.")),
  html_url: Schema.String.pipe(field(12, "Review on GitHub.")),
})
  .annotate({
    description: "Reviews on pull requests. Pending reviews are only visible to their author.",
  })
  .pipe(Iceberg.identifier("id"));

export type PullRequestReview = Schema.Schema.Type<typeof PullRequestReviewSchema>;

export const PullRequestReviewObjectSchema = PullRequestReviewSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "repository_id", "pull_request_number"]),
);

export type PullRequestReviewObject = Schema.Schema.Type<typeof PullRequestReviewObjectSchema>;
