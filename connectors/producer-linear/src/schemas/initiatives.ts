import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import {
  Long,
  OptionalRef,
  OptionalString,
  OptionalTimestamp,
  Ref,
  common,
  deleted,
  field,
  list,
} from "./shared";

export const InitiativeSchema = Schema.Struct({
  ...common("Initiative"),
  _deleted: deleted("initiative"),
  name: Schema.String.pipe(field(10, "Initiative name.")),
  description: OptionalString.pipe(field(11, "Short summary.")),
  content: OptionalString.pipe(field(12, "Initiative overview in markdown.")),
  url: Schema.String.pipe(field(13, "Initiative URL.")),
  icon: OptionalString.pipe(field(14, "Icon.")),
  color: OptionalString.pipe(field(15, "Color, as hex.")),
  status: Schema.String.pipe(field(16, "Status: Planned, Active, or Completed.")),
  health: OptionalString.pipe(field(17, "Health from the latest update.")),
  health_updated_at: OptionalTimestamp.pipe(field(18, "Time the health last changed.")),
  priority: Long.pipe(field(19, "0 none, 1 urgent, 2 high, 3 medium, 4 low.")),
  owner_id: OptionalRef.pipe(field(20, "Initiative owner.")),
  creator_id: OptionalRef.pipe(field(21, "User who made the initiative.")),
  parent_initiative_id: OptionalRef.pipe(field(22, "Parent initiative.")),
  target_date: OptionalString.pipe(field(23, "Target date, as YYYY-MM-DD.")),
  started_at: OptionalTimestamp.pipe(field(24, "Time the initiative started.")),
  completed_at: OptionalTimestamp.pipe(field(25, "Time the initiative was completed.")),
  canceled_at: OptionalTimestamp.pipe(field(26, "Time the initiative was canceled.")),
  label_ids: list(101, Schema.String).pipe(field(27, "Initiative labels.")),
  visibility: Schema.String.pipe(field(28, "Who can see the initiative.")),
  trashed: Schema.NullOr(Schema.Boolean).pipe(field(29, "Whether the initiative is in the trash.")),
})
  .annotate({ description: "Linear initiatives, including archived and trashed ones." })
  .pipe(Iceberg.identifier("id"));

export type Initiative = Schema.Schema.Type<typeof InitiativeSchema>;

export const InitiativeObjectSchema = InitiativeSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const InitiativeUpdateSchema = Schema.Struct({
  ...common("Update"),
  _deleted: deleted("update"),
  initiative_id: Ref.pipe(field(10, "Initiative.")),
  user_id: Ref.pipe(field(11, "User who posted the update.")),
  body: Schema.String.pipe(field(12, "Update text in markdown.")),
  health: Schema.String.pipe(field(13, "Health: onTrack, atRisk, or offTrack.")),
  url: Schema.String.pipe(field(14, "Update URL.")),
  edited_at: OptionalTimestamp.pipe(field(15, "Time the update was last edited.")),
  comment_count: Long.pipe(field(16, "Comments on the update.")),
})
  .annotate({ description: "Linear initiative updates: status posts with a health." })
  .pipe(Iceberg.identifier("id"));

export type InitiativeUpdate = Schema.Schema.Type<typeof InitiativeUpdateSchema>;

export const InitiativeUpdateObjectSchema = InitiativeUpdateSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const InitiativeLabelSchema = Schema.Struct({
  ...common("Label"),
  name: Schema.String.pipe(field(10, "Label name.")),
  description: OptionalString.pipe(field(11, "Label description.")),
  color: Schema.String.pipe(field(12, "Label color, as hex.")),
  is_group: Schema.Boolean.pipe(field(13, "Whether the label groups other labels.")),
  parent_id: OptionalRef.pipe(field(14, "Label group.")),
  creator_id: OptionalRef.pipe(field(15, "User who made the label.")),
  retired_at: OptionalTimestamp.pipe(field(16, "Time the label was retired.")),
})
  .annotate({ description: "Linear initiative labels. Names the IDs in `initiatives.label_ids`." })
  .pipe(Iceberg.identifier("id"));

export type InitiativeLabel = Schema.Schema.Type<typeof InitiativeLabelSchema>;

export const InitiativeLabelObjectSchema = InitiativeLabelSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const InitiativeRelationSchema = Schema.Struct({
  ...common("Relation"),
  initiative_id: Ref.pipe(field(10, "Initiative the relation starts from.")),
  related_initiative_id: Ref.pipe(field(11, "Related initiative.")),
  sort_order: Schema.Finite.pipe(field(12, "Order.")),
  user_id: OptionalRef.pipe(field(13, "User who made the relation.")),
})
  .annotate({ description: "Linear initiative relations. Deleted relations aren't seen." })
  .pipe(Iceberg.identifier("id"));

export type InitiativeRelation = Schema.Schema.Type<typeof InitiativeRelationSchema>;

export const InitiativeRelationObjectSchema = InitiativeRelationSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const InitiativeToProjectSchema = Schema.Struct({
  ...common("Link"),
  initiative_id: Ref.pipe(field(10, "Initiative.")),
  project_id: Ref.pipe(field(11, "Project.")),
  sort_order: Schema.String.pipe(field(12, "Order within the initiative.")),
})
  .annotate({
    description: "Links between Linear initiatives and projects. Removed links aren't seen.",
  })
  .pipe(Iceberg.identifier("id"));

export type InitiativeToProject = Schema.Schema.Type<typeof InitiativeToProjectSchema>;

export const InitiativeToProjectObjectSchema = InitiativeToProjectSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);
