import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, deleted, field, version } from "./shared";

export const GroupMembershipSchema = Schema.Struct({
  id: Long.pipe(field(1, "Membership ID.")),
  version: version(2, "membership"),
  _deleted: deleted(3, "membership"),
  created_at: Timestamp.pipe(field(4, "Time the agent was added to the group.")),
  updated_at: Timestamp.pipe(field(5, "Time the membership was last updated.")),
  user_id: Long.pipe(field(6, "Agent in the group.")),
  group_id: Long.pipe(field(7, "Group.")),
  default: Schema.Boolean.pipe(field(8, "Whether this is the agent's default group.")),
})
  .annotate({ description: "Which agents are in which Zendesk groups." })
  .pipe(Iceberg.identifier("id"));

export type GroupMembership = Schema.Schema.Type<typeof GroupMembershipSchema>;

export const OrganizationMembershipSchema = Schema.Struct({
  id: Long.pipe(field(1, "Membership ID.")),
  version: version(2, "membership"),
  _deleted: deleted(3, "membership"),
  created_at: Timestamp.pipe(field(4, "Time the user was added to the organization.")),
  updated_at: Timestamp.pipe(field(5, "Time the membership was last updated.")),
  user_id: Long.pipe(field(6, "User in the organization.")),
  organization_id: Long.pipe(field(7, "Organization.")),
  default: Schema.NullOr(Schema.Boolean).pipe(
    field(8, "Whether this is the user's default organization."),
  ),
  view_tickets: Schema.Boolean.pipe(
    field(9, "Whether the user can see the organization's tickets."),
  ),
})
  .annotate({
    description: "Which users are in which Zendesk organizations. A user can be in several.",
  })
  .pipe(Iceberg.identifier("id"));

export type OrganizationMembership = Schema.Schema.Type<typeof OrganizationMembershipSchema>;

const objectOf = <F extends Schema.Struct.Fields>(schema: Schema.Struct<F>) =>
  schema.mapFields((fields) => Struct.omit(fields, ["version", "_deleted"]));

export const GroupMembershipObjectSchema = objectOf(GroupMembershipSchema);
export const OrganizationMembershipObjectSchema = objectOf(OrganizationMembershipSchema);
