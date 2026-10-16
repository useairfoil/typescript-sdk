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

export const IssueSchema = Schema.Struct({
  ...common("Issue"),
  _deleted: deleted("issue"),
  identifier: Schema.String.pipe(field(10, "Readable ID, such as ENG-123.")),
  number: Schema.Finite.pipe(field(11, "Issue number within its team.")),
  title: Schema.String.pipe(field(12, "Issue title.")),
  description: OptionalString.pipe(field(13, "Description in markdown.")),
  url: Schema.String.pipe(field(14, "Issue URL.")),
  branch_name: Schema.String.pipe(field(15, "Suggested Git branch name.")),
  priority: Schema.Finite.pipe(field(16, "0 none, 1 urgent, 2 high, 3 medium, 4 low.")),
  priority_label: Schema.String.pipe(field(17, "Priority name.")),
  estimate: Schema.NullOr(Schema.Finite).pipe(field(18, "Estimate, on the team's scale.")),
  due_date: OptionalString.pipe(field(19, "Due date, as YYYY-MM-DD.")),
  creator_id: OptionalRef.pipe(field(20, "User who created the issue.")),
  assignee_id: OptionalRef.pipe(field(21, "Assigned user.")),
  delegate_id: OptionalRef.pipe(field(22, "Agent user working on the issue.")),
  snoozed_by_id: OptionalRef.pipe(field(23, "User who snoozed the issue.")),
  state_id: Ref.pipe(field(24, "Workflow state.")),
  team_id: Ref.pipe(field(25, "Team the issue belongs to.")),
  project_id: OptionalRef.pipe(field(26, "Project.")),
  project_milestone_id: OptionalRef.pipe(field(27, "Project milestone.")),
  cycle_id: OptionalRef.pipe(field(28, "Cycle.")),
  parent_id: OptionalRef.pipe(field(29, "Parent issue.")),
  source_comment_id: OptionalRef.pipe(field(30, "Comment the issue was made from.")),
  external_user_creator_id: OptionalRef.pipe(
    field(31, "External user who created the issue through an integration."),
  ),
  label_ids: list(101, Schema.String).pipe(field(32, "Labels.")),
  previous_identifiers: list(102, Schema.String).pipe(
    field(33, "Earlier readable IDs, from before the issue moved team."),
  ),
  started_at: OptionalTimestamp.pipe(field(34, "Time the issue moved to a started state.")),
  completed_at: OptionalTimestamp.pipe(field(35, "Time the issue was completed.")),
  canceled_at: OptionalTimestamp.pipe(field(36, "Time the issue was canceled.")),
  started_triage_at: OptionalTimestamp.pipe(field(37, "Time the issue entered triage.")),
  triaged_at: OptionalTimestamp.pipe(field(38, "Time the issue left triage.")),
  auto_closed_at: OptionalTimestamp.pipe(field(39, "Time the issue was closed automatically.")),
  auto_archived_at: OptionalTimestamp.pipe(field(40, "Time the issue was archived automatically.")),
  added_to_cycle_at: OptionalTimestamp.pipe(field(41, "Time the issue was added to its cycle.")),
  added_to_project_at: OptionalTimestamp.pipe(
    field(42, "Time the issue was added to its project."),
  ),
  added_to_team_at: OptionalTimestamp.pipe(field(43, "Time the issue was added to its team.")),
  snoozed_until_at: OptionalTimestamp.pipe(field(44, "Time the issue is snoozed until.")),
  sla_type: OptionalString.pipe(field(45, "SLA type.")),
  sla_started_at: OptionalTimestamp.pipe(field(46, "Time the SLA started.")),
  sla_breaches_at: OptionalTimestamp.pipe(field(47, "Time the SLA breaches.")),
  customer_ticket_count: Long.pipe(field(48, "Linked support tickets.")),
  integration_source_type: OptionalString.pipe(field(49, "Integration that created the issue.")),
  trashed: Schema.NullOr(Schema.Boolean).pipe(field(50, "Whether the issue is in the trash.")),
})
  .annotate({ description: "Linear issues, including archived and trashed ones." })
  .pipe(Iceberg.identifier("id"));

export type Issue = Schema.Schema.Type<typeof IssueSchema>;

export const IssueObjectSchema = IssueSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const IssueHistorySchema = Schema.Struct({
  ...common("History entry"),
  issue_id: Schema.String.pipe(field(10, "Issue that changed.")),
  actor_id: OptionalString.pipe(field(11, "User who made the change.")),
  from_state_id: OptionalString.pipe(field(12, "Workflow state before.")),
  to_state_id: OptionalString.pipe(field(13, "Workflow state after.")),
  from_assignee_id: OptionalString.pipe(field(14, "Assignee before.")),
  to_assignee_id: OptionalString.pipe(field(15, "Assignee after.")),
  from_cycle_id: OptionalString.pipe(field(16, "Cycle before.")),
  to_cycle_id: OptionalString.pipe(field(17, "Cycle after.")),
  from_project_id: OptionalString.pipe(field(18, "Project before.")),
  to_project_id: OptionalString.pipe(field(19, "Project after.")),
  from_parent_id: OptionalString.pipe(field(20, "Parent issue before.")),
  to_parent_id: OptionalString.pipe(field(21, "Parent issue after.")),
  from_team_id: OptionalString.pipe(field(22, "Team before.")),
  to_team_id: OptionalString.pipe(field(23, "Team after.")),
  from_priority: Schema.NullOr(Schema.Finite).pipe(field(24, "Priority before.")),
  to_priority: Schema.NullOr(Schema.Finite).pipe(field(25, "Priority after.")),
  from_estimate: Schema.NullOr(Schema.Finite).pipe(field(26, "Estimate before.")),
  to_estimate: Schema.NullOr(Schema.Finite).pipe(field(27, "Estimate after.")),
  from_due_date: OptionalString.pipe(field(28, "Due date before, as YYYY-MM-DD.")),
  to_due_date: OptionalString.pipe(field(29, "Due date after, as YYYY-MM-DD.")),
  from_title: OptionalString.pipe(field(30, "Title before.")),
  to_title: OptionalString.pipe(field(31, "Title after.")),
  added_label_ids: Schema.NullOr(list(101, Schema.String)).pipe(field(32, "Labels added.")),
  removed_label_ids: Schema.NullOr(list(102, Schema.String)).pipe(field(33, "Labels removed.")),
  attachment_id: OptionalString.pipe(field(34, "Attachment linked or unlinked.")),
  customer_need_id: OptionalString.pipe(field(35, "Customer request linked or unlinked.")),
  to_converted_project_id: OptionalString.pipe(field(36, "Project the issue became.")),
  updated_description: Schema.NullOr(Schema.Boolean).pipe(
    field(37, "Whether the description changed."),
  ),
  archived: Schema.NullOr(Schema.Boolean).pipe(field(38, "Whether the issue was archived.")),
  trashed: Schema.NullOr(Schema.Boolean).pipe(field(39, "Whether the issue was trashed.")),
  auto_archived: Schema.NullOr(Schema.Boolean).pipe(
    field(40, "Whether the issue was archived automatically."),
  ),
  auto_closed: Schema.NullOr(Schema.Boolean).pipe(
    field(41, "Whether the issue was closed automatically."),
  ),
})
  .annotate({ description: "Linear issue history. One row per change to an issue." })
  .pipe(Iceberg.identifier("id"));

export type IssueHistory = Schema.Schema.Type<typeof IssueHistorySchema>;

export const IssueHistoryObjectSchema = IssueHistorySchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "issue_id"]),
);

export const IssueRelationSchema = Schema.Struct({
  ...common("Relation"),
  issue_id: Ref.pipe(field(10, "Issue the relation starts from.")),
  related_issue_id: Ref.pipe(field(11, "Related issue.")),
  type: Schema.String.pipe(field(12, "Relation type: blocks, duplicate, related, or similar.")),
})
  .annotate({ description: "Linear issue relations. Deleted relations aren't seen." })
  .pipe(Iceberg.identifier("id"));

export type IssueRelation = Schema.Schema.Type<typeof IssueRelationSchema>;

export const IssueRelationObjectSchema = IssueRelationSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const AttachmentSchema = Schema.Struct({
  ...common("Attachment"),
  _deleted: deleted("attachment"),
  issue_id: Ref.pipe(field(10, "Issue the attachment is on.")),
  creator_id: OptionalRef.pipe(field(11, "User who added it.")),
  external_user_creator_id: OptionalRef.pipe(field(12, "External user who added it.")),
  title: Schema.String.pipe(field(13, "Title.")),
  subtitle: OptionalString.pipe(field(14, "Subtitle.")),
  url: Schema.String.pipe(field(15, "Linked URL, such as a pull request or ticket.")),
  source_type: OptionalString.pipe(field(16, "Source, such as github or zendesk.")),
})
  .annotate({ description: "Linear issue attachments: links to pull requests, tickets, and more." })
  .pipe(Iceberg.identifier("id"));

export type Attachment = Schema.Schema.Type<typeof AttachmentSchema>;

export const AttachmentObjectSchema = AttachmentSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const IssueLabelSchema = Schema.Struct({
  ...common("Label"),
  _deleted: deleted("label"),
  name: Schema.String.pipe(field(10, "Label name.")),
  description: OptionalString.pipe(field(11, "Label description.")),
  color: Schema.String.pipe(field(12, "Label color, as hex.")),
  is_group: Schema.Boolean.pipe(field(13, "Whether the label groups other labels.")),
  parent_id: OptionalRef.pipe(field(14, "Label group.")),
  team_id: OptionalRef.pipe(field(15, "Team, or null for a workspace label.")),
  creator_id: OptionalRef.pipe(field(16, "User who made the label.")),
  retired_at: OptionalTimestamp.pipe(field(17, "Time the label was retired.")),
})
  .annotate({ description: "Linear issue labels. Names the IDs in `issues.label_ids`." })
  .pipe(Iceberg.identifier("id"));

export type IssueLabel = Schema.Schema.Type<typeof IssueLabelSchema>;

export const IssueLabelObjectSchema = IssueLabelSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);
