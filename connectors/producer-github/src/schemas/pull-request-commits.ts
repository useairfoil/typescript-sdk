import { Iceberg } from "@useairfoil/connector-kit";
import { Schema } from "effect";

import { account, gitActor } from "./commits";
import { Long, field } from "./shared";

export const PullRequestCommitSchema = Schema.Struct({
  key: Schema.String.pipe(
    field(1, "Repository ID, pull request number, and SHA, such as `1406396726:3:9eb3a7d`."),
  ),
  version: Schema.Date.pipe(field(2, "Time GitHub last updated the pull request.")),
  repository_id: Long.pipe(field(3, "ID of the repository the pull request belongs to.")),
  pull_request_number: Long.pipe(field(4, "Pull request number in the repository.")),
  sha: Schema.String.pipe(field(5, "Commit SHA.")),
  message: Schema.String.pipe(field(6, "Commit message.")),
  author: gitActor(100).pipe(field(7, "Author name and time from the commit.")),
  committer: gitActor(102).pipe(field(8, "Committer name and time from the commit.")),
  author_user: account(104).pipe(field(9, "GitHub account of the author.")),
  committer_user: account(107).pipe(field(10, "GitHub account of the committer.")),
  html_url: Schema.String.pipe(field(11, "Commit page on GitHub.")),
})
  .annotate({
    description:
      "Commits in pull requests, up to 250 per pull request. Commits removed by a force push stay.",
  })
  .pipe(Iceberg.identifier("key"));

export type PullRequestCommit = Schema.Schema.Type<typeof PullRequestCommitSchema>;
