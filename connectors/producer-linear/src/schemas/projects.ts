import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import {
  Long,
  OptionalRef,
  OptionalString,
  OptionalTimestamp,
  Ref,
  RefList,
  common,
  deleted,
  field,
  list,
} from "./shared";

export const ProjectSchema = Schema.Struct({
  ...common("Project"),
  _deleted: deleted("project"),
  name: Schema.String.pipe(field(10, "Project name.")),
  description: Schema.String.pipe(field(11, "Short summary.")),
  content: OptionalString.pipe(field(12, "Project overview in markdown.")),
  url: Schema.String.pipe(field(13, "Project URL.")),
  icon: OptionalString.pipe(field(14, "Icon.")),
  color: Schema.String.pipe(field(15, "Color, as hex.")),
  status_id: Ref.pipe(field(16, "Project status.")),
  priority: Long.pipe(field(17, "0 none, 1 urgent, 2 high, 3 medium, 4 low.")),
  priority_label: Schema.String.pipe(field(18, "Priority name.")),
  health: OptionalString.pipe(field(19, "Health from the latest update.")),
  health_updated_at: OptionalTimestamp.pipe(field(20, "Time the health last changed.")),
  progress: Schema.Finite.pipe(field(21, "Share of the scope completed, from 0 to 1.")),
  scope: Schema.Finite.pipe(field(22, "Total estimate of the project's issues.")),
  lead_id: OptionalRef.pipe(field(23, "Project lead.")),
  creator_id: OptionalRef.pipe(field(24, "User who made the project.")),
  converted_from_issue_id: OptionalRef.pipe(field(25, "Issue the project was made from.")),
  start_date: OptionalString.pipe(field(26, "Start date, as YYYY-MM-DD.")),
  target_date: OptionalString.pipe(field(27, "Target date, as YYYY-MM-DD.")),
  started_at: OptionalTimestamp.pipe(field(28, "Time the project started.")),
  completed_at: OptionalTimestamp.pipe(field(29, "Time the project was completed.")),
  canceled_at: OptionalTimestamp.pipe(field(30, "Time the project was canceled.")),
  auto_archived_at: OptionalTimestamp.pipe(
    field(31, "Time the project was archived automatically."),
  ),
  label_ids: list(101, Schema.String).pipe(field(32, "Project labels.")),
  team_ids: RefList(102).pipe(field(33, "Teams the project belongs to. Reads up to 50.")),
  member_ids: RefList(103).pipe(field(34, "Project members. Reads up to 100.")),
  trashed: Schema.NullOr(Schema.Boolean).pipe(field(35, "Whether the project is in the trash.")),
})
  .annotate({ description: "Linear projects, including archived and trashed ones." })
  .pipe(Iceberg.identifier("id"));

export type Project = Schema.Schema.Type<typeof ProjectSchema>;

export const ProjectObjectSchema = ProjectSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const ProjectMilestoneSchema = Schema.Struct({
  ...common("Milestone"),
  name: Schema.String.pipe(field(10, "Milestone name.")),
  description: OptionalString.pipe(field(11, "Description in markdown.")),
  project_id: Ref.pipe(field(12, "Project.")),
  target_date: OptionalString.pipe(field(13, "Target date, as YYYY-MM-DD.")),
  status: Schema.String.pipe(field(14, "Status: unstarted, next, overdue, or done.")),
  progress: Schema.Finite.pipe(field(15, "Share of the scope completed, from 0 to 1.")),
  sort_order: Schema.Finite.pipe(field(16, "Order within the project.")),
})
  .annotate({ description: "Linear project milestones. Deleted milestones aren't seen." })
  .pipe(Iceberg.identifier("id"));

export type ProjectMilestone = Schema.Schema.Type<typeof ProjectMilestoneSchema>;

export const ProjectMilestoneObjectSchema = ProjectMilestoneSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const ProjectUpdateSchema = Schema.Struct({
  ...common("Update"),
  _deleted: deleted("update"),
  project_id: Ref.pipe(field(10, "Project.")),
  user_id: Ref.pipe(field(11, "User who posted the update.")),
  body: Schema.String.pipe(field(12, "Update text in markdown.")),
  health: Schema.String.pipe(field(13, "Health: onTrack, atRisk, or offTrack.")),
  url: Schema.String.pipe(field(14, "Update URL.")),
  edited_at: OptionalTimestamp.pipe(field(15, "Time the update was last edited.")),
  comment_count: Long.pipe(field(16, "Comments on the update.")),
})
  .annotate({ description: "Linear project updates: status posts with a health." })
  .pipe(Iceberg.identifier("id"));

export type ProjectUpdate = Schema.Schema.Type<typeof ProjectUpdateSchema>;

export const ProjectUpdateObjectSchema = ProjectUpdateSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const ProjectStatusSchema = Schema.Struct({
  ...common("Status"),
  name: Schema.String.pipe(field(10, "Status name.")),
  type: Schema.String.pipe(
    field(11, "Status type: backlog, planned, started, paused, completed, or canceled."),
  ),
  color: Schema.String.pipe(field(12, "Color, as hex.")),
  description: OptionalString.pipe(field(13, "Description.")),
  position: Schema.Finite.pipe(field(14, "Order in the list.")),
})
  .annotate({ description: "Linear project statuses. Names the IDs in `projects.status_id`." })
  .pipe(Iceberg.identifier("id"));

export type ProjectStatus = Schema.Schema.Type<typeof ProjectStatusSchema>;

export const ProjectStatusObjectSchema = ProjectStatusSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const ProjectLabelSchema = Schema.Struct({
  ...common("Label"),
  _deleted: deleted("label"),
  name: Schema.String.pipe(field(10, "Label name.")),
  description: OptionalString.pipe(field(11, "Label description.")),
  color: Schema.String.pipe(field(12, "Label color, as hex.")),
  is_group: Schema.Boolean.pipe(field(13, "Whether the label groups other labels.")),
  parent_id: OptionalRef.pipe(field(14, "Label group.")),
  creator_id: OptionalRef.pipe(field(15, "User who made the label.")),
  retired_at: OptionalTimestamp.pipe(field(16, "Time the label was retired.")),
})
  .annotate({ description: "Linear project labels. Names the IDs in `projects.label_ids`." })
  .pipe(Iceberg.identifier("id"));

export type ProjectLabel = Schema.Schema.Type<typeof ProjectLabelSchema>;

export const ProjectLabelObjectSchema = ProjectLabelSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const ProjectRelationSchema = Schema.Struct({
  ...common("Relation"),
  type: Schema.String.pipe(field(10, "Relation type, such as dependency.")),
  project_id: Ref.pipe(field(11, "Project the relation starts from.")),
  project_milestone_id: OptionalRef.pipe(field(12, "Milestone the relation starts from.")),
  anchor_type: Schema.String.pipe(field(13, "Which end of the project it starts from.")),
  related_project_id: Ref.pipe(field(14, "Related project.")),
  related_project_milestone_id: OptionalRef.pipe(field(15, "Related milestone.")),
  related_anchor_type: Schema.String.pipe(field(16, "Which end of the related project.")),
  user_id: OptionalRef.pipe(field(17, "User who made the relation.")),
})
  .annotate({ description: "Linear project dependencies. Deleted relations aren't seen." })
  .pipe(Iceberg.identifier("id"));

export type ProjectRelation = Schema.Schema.Type<typeof ProjectRelationSchema>;

export const ProjectRelationObjectSchema = ProjectRelationSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);
