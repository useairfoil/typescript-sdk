import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import {
  OptionalRef,
  OptionalString,
  OptionalTimestamp,
  Ref,
  Timestamp,
  common,
  deleted,
  field,
} from "./shared";

export const TeamSchema = Schema.Struct({
  ...common("Team"),
  name: Schema.String.pipe(field(10, "Team name.")),
  key: Schema.String.pipe(field(11, "Team key, used in issue IDs such as ENG-123.")),
  display_name: Schema.String.pipe(field(12, "Name shown in Linear.")),
  description: OptionalString.pipe(field(13, "Team description.")),
  visibility: Schema.String.pipe(field(14, "Who can see the team.")),
  parent_id: OptionalRef.pipe(field(15, "Parent team.")),
  timezone: Schema.String.pipe(field(16, "Team timezone.")),
  cycles_enabled: Schema.Boolean.pipe(field(17, "Whether the team uses cycles.")),
  cycle_duration: Schema.Finite.pipe(field(18, "Cycle length in weeks.")),
  cycle_cooldown_time: Schema.Finite.pipe(field(19, "Weeks between cycles.")),
  cycle_start_day: Schema.Finite.pipe(field(20, "Day cycles start, 0 for Sunday.")),
  triage_enabled: Schema.Boolean.pipe(field(21, "Whether the team uses triage.")),
  issue_estimation_type: Schema.String.pipe(field(22, "Estimate scale.")),
  default_issue_estimate: Schema.Finite.pipe(field(23, "Default estimate.")),
  auto_archive_period: Schema.Finite.pipe(field(24, "Months before closed issues are archived.")),
  auto_close_period: Schema.NullOr(Schema.Finite).pipe(
    field(25, "Months before stale issues are closed."),
  ),
  retired_at: OptionalTimestamp.pipe(field(26, "Time the team was retired.")),
})
  .annotate({ description: "Linear teams." })
  .pipe(Iceberg.identifier("id"));

export type Team = Schema.Schema.Type<typeof TeamSchema>;

export const TeamObjectSchema = TeamSchema.mapFields((fields) => Struct.omit(fields, ["version"]));

export const TeamMembershipSchema = Schema.Struct({
  ...common("Membership"),
  team_id: Ref.pipe(field(10, "Team.")),
  user_id: Ref.pipe(field(11, "User.")),
  owner: Schema.Boolean.pipe(field(12, "Whether the user owns the team.")),
})
  .annotate({ description: "Linear team members. Removed members aren't seen." })
  .pipe(Iceberg.identifier("id"));

export type TeamMembership = Schema.Schema.Type<typeof TeamMembershipSchema>;

export const TeamMembershipObjectSchema = TeamMembershipSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const WorkflowStateSchema = Schema.Struct({
  ...common("Workflow state"),
  name: Schema.String.pipe(field(10, "State name.")),
  type: Schema.String.pipe(
    field(11, "State type: triage, backlog, unstarted, started, completed, or canceled."),
  ),
  color: Schema.String.pipe(field(12, "State color, as hex.")),
  description: OptionalString.pipe(field(13, "State description.")),
  position: Schema.Finite.pipe(field(14, "Order within the team.")),
  team_id: Ref.pipe(field(15, "Team.")),
})
  .annotate({ description: "Linear workflow states. Names the IDs in `issues.state_id`." })
  .pipe(Iceberg.identifier("id"));

export type WorkflowState = Schema.Schema.Type<typeof WorkflowStateSchema>;

export const WorkflowStateObjectSchema = WorkflowStateSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const UserSchema = Schema.Struct({
  ...common("User"),
  _deleted: deleted("user"),
  name: Schema.String.pipe(field(10, "Full name.")),
  display_name: Schema.String.pipe(field(11, "Display name.")),
  email: Schema.String.pipe(field(12, "Email address.")),
  avatar_url: OptionalString.pipe(field(13, "Avatar image URL.")),
  title: OptionalString.pipe(field(14, "Job title.")),
  timezone: OptionalString.pipe(field(15, "Timezone.")),
  active: Schema.Boolean.pipe(field(16, "Whether the user is active.")),
  admin: Schema.Boolean.pipe(field(17, "Whether the user is an admin.")),
  owner: Schema.Boolean.pipe(field(18, "Whether the user owns the workspace.")),
  guest: Schema.Boolean.pipe(field(19, "Whether the user is a guest.")),
  app: Schema.Boolean.pipe(field(20, "Whether the user is an app or agent.")),
  last_seen: OptionalTimestamp.pipe(field(21, "Time the user was last online.")),
  url: Schema.String.pipe(field(22, "Profile URL.")),
})
  .annotate({ description: "Linear users." })
  .pipe(Iceberg.identifier("id"));

export type User = Schema.Schema.Type<typeof UserSchema>;

export const UserObjectSchema = UserSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const ExternalUserSchema = Schema.Struct({
  ...common("External user"),
  name: Schema.String.pipe(field(10, "Name.")),
  display_name: Schema.String.pipe(field(11, "Display name.")),
  email: OptionalString.pipe(field(12, "Email address.")),
  avatar_url: OptionalString.pipe(field(13, "Avatar image URL.")),
  last_seen: OptionalTimestamp.pipe(field(14, "Time the user was last seen.")),
})
  .annotate({
    description: "People from integrations, such as Slack, who create issues and comments.",
  })
  .pipe(Iceberg.identifier("id"));

export type ExternalUser = Schema.Schema.Type<typeof ExternalUserSchema>;

export const ExternalUserObjectSchema = ExternalUserSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const CycleSchema = Schema.Struct({
  ...common("Cycle"),
  _deleted: deleted("cycle"),
  number: Schema.Finite.pipe(field(10, "Cycle number within its team.")),
  name: OptionalString.pipe(field(11, "Cycle name.")),
  description: OptionalString.pipe(field(12, "Cycle description.")),
  team_id: Ref.pipe(field(13, "Team.")),
  starts_at: Timestamp.pipe(field(14, "Time the cycle starts.")),
  ends_at: Timestamp.pipe(field(15, "Time the cycle ends.")),
  completed_at: OptionalTimestamp.pipe(field(16, "Time the cycle was completed.")),
  auto_archived_at: OptionalTimestamp.pipe(field(17, "Time the cycle was archived automatically.")),
  progress: Schema.Finite.pipe(field(18, "Share of the scope completed, from 0 to 1.")),
})
  .annotate({ description: "Linear cycles." })
  .pipe(Iceberg.identifier("id"));

export type Cycle = Schema.Schema.Type<typeof CycleSchema>;

export const CycleObjectSchema = CycleSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);
