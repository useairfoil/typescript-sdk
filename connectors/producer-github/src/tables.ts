import type { Schema } from "effect";

import { IssueCommentSchema } from "./schemas/issue-comments";
import { IssueSchema } from "./schemas/issues";
import { PullRequestSchema } from "./schemas/pull-requests";
import { RepositorySchema } from "./schemas/repositories";

export const tableSchemas: Readonly<Record<string, Schema.Top>> = {
  repositories: RepositorySchema,
  issues: IssueSchema,
  pull_requests: PullRequestSchema,
  issue_comments: IssueCommentSchema,
};
