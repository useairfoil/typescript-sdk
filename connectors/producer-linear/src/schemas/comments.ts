import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { OptionalRef, OptionalString, OptionalTimestamp, common, deleted, field } from "./shared";

export const CommentSchema = Schema.Struct({
  ...common("Comment"),
  _deleted: deleted("comment"),
  body: Schema.String.pipe(field(10, "Comment text in markdown.")),
  user_id: OptionalRef.pipe(field(11, "User who wrote the comment.")),
  external_user_id: OptionalRef.pipe(field(12, "External user who wrote the comment.")),
  issue_id: OptionalString.pipe(field(13, "Issue the comment is on.")),
  project_id: OptionalString.pipe(field(14, "Project the comment is on.")),
  project_update_id: OptionalString.pipe(field(15, "Project update the comment is on.")),
  initiative_id: OptionalString.pipe(field(16, "Initiative the comment is on.")),
  initiative_update_id: OptionalString.pipe(field(17, "Initiative update the comment is on.")),
  document_content_id: OptionalString.pipe(field(18, "Document content the comment is on.")),
  parent_id: OptionalString.pipe(field(19, "Comment this one replies to.")),
  quoted_text: OptionalString.pipe(field(20, "Text the comment quotes.")),
  edited_at: OptionalTimestamp.pipe(field(21, "Time the comment was last edited.")),
  resolved_at: OptionalTimestamp.pipe(field(22, "Time the thread was resolved.")),
  resolving_user_id: OptionalRef.pipe(field(23, "User who resolved the thread.")),
  url: Schema.String.pipe(field(24, "Comment URL.")),
})
  .annotate({ description: "Linear comments on issues, projects, initiatives, and updates." })
  .pipe(Iceberg.identifier("id"));

export type Comment = Schema.Schema.Type<typeof CommentSchema>;

export const CommentObjectSchema = CommentSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);
