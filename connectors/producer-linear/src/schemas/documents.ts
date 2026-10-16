import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { OptionalRef, OptionalString, OptionalTimestamp, common, deleted, field } from "./shared";

export const DocumentSchema = Schema.Struct({
  ...common("Document"),
  _deleted: deleted("document"),
  title: Schema.String.pipe(field(10, "Title.")),
  content: OptionalString.pipe(field(11, "Content in markdown.")),
  url: Schema.String.pipe(field(12, "Document URL.")),
  icon: OptionalString.pipe(field(13, "Icon.")),
  color: OptionalString.pipe(field(14, "Icon color.")),
  creator_id: OptionalRef.pipe(field(15, "User who made the document.")),
  updated_by_id: OptionalRef.pipe(field(16, "User who last changed the document.")),
  project_id: OptionalRef.pipe(field(17, "Project the document is in.")),
  initiative_id: OptionalRef.pipe(field(18, "Initiative the document is in.")),
  issue_id: OptionalRef.pipe(field(19, "Issue the document is in.")),
  cycle_id: OptionalRef.pipe(field(20, "Cycle the document is in.")),
  team_id: OptionalRef.pipe(field(21, "Team the document is in.")),
  parent_document_id: OptionalRef.pipe(field(22, "Parent document.")),
  hidden_at: OptionalTimestamp.pipe(field(23, "Time the document was hidden.")),
  trashed: Schema.NullOr(Schema.Boolean).pipe(field(24, "Whether the document is in the trash.")),
})
  .annotate({ description: "Linear documents, including archived and trashed ones." })
  .pipe(Iceberg.identifier("id"));

export type Document = Schema.Schema.Type<typeof DocumentSchema>;

export const DocumentObjectSchema = DocumentSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);
