import { Resource } from "@useairfoil/connector-kit";

import type { LinearClientService } from "../client/client";

import { CommentObjectSchema, CommentSchema } from "../schemas/comments";
import { backfillList, changesList, checkList, listSpec, rowsOf, webhookList } from "./pages";

export const commentSpec = listSpec({
  connection: "comments",
  single: "comment",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    body user_id: user { id } external_user_id: externalUser { id }
    issue_id: issueId project_id: projectId project_update_id: projectUpdateId
    initiative_id: initiativeId initiative_update_id: initiativeUpdateId
    document_content_id: documentContentId parent_id: parentId quoted_text: quotedText
    edited_at: editedAt resolved_at: resolvedAt resolving_user_id: resolvingUser { id } url`,
  item: CommentObjectSchema,
  updatedAt: (comment) => comment.updated_at,
  rows: rowsOf((comment) => ({ ...comment, version: comment.updated_at, _deleted: false })),
});

export const makeComments = (client: LinearClientService) =>
  Resource.entity({
    name: "comments",
    rowSchema: CommentSchema,
    version: "version",

    check: checkList(client, commentSpec),
    backfill: backfillList(client, commentSpec),
    changes: changesList(client, commentSpec),
    webhook: webhookList(client, commentSpec),
  });
