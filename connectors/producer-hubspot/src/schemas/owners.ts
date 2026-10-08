import { Schema, Struct } from "effect";

import { Long, Timestamp, field, list, version } from "./shared";

const TeamSchema = Schema.Struct({
  id: Schema.String.pipe(field(102, "Team ID.")),
  name: Schema.String.pipe(field(103, "Team name.")),
  primary: Schema.Boolean.pipe(field(104, "Whether this is the owner's main team.")),
});

export const OwnerSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Owner ID, as used in `hubspot_owner_id`.")),
  version: version(2),
  type: Schema.String.pipe(field(3, "PERSON for a user, or QUEUE.")),
  email: Schema.optional(Schema.String).pipe(field(4, "Owner email.")),
  first_name: Schema.optional(Schema.String).pipe(field(5, "Owner first name.")),
  last_name: Schema.optional(Schema.String).pipe(field(6, "Owner last name.")),
  user_id: Schema.optional(Long).pipe(field(7, "HubSpot user ID. Empty for a removed user.")),
  user_id_including_inactive: Schema.optional(Long).pipe(
    field(8, "HubSpot user ID, also for a removed user."),
  ),
  teams: list(101, TeamSchema).pipe(field(9, "Teams of the owner.")),
  archived: Schema.Boolean.pipe(field(10, "Whether the user was removed from HubSpot.")),
  created_at: Schema.Date.pipe(field(11, "Time the owner was created.")),
}).annotate({ description: "HubSpot users and queues that can own records." });

export type Owner = Schema.Schema.Type<typeof OwnerSchema>;

/** An owner as the API returns it. */
export const OwnerObjectSchema = Schema.Struct({
  ...Struct.pick(OwnerSchema.fields, ["id", "type", "archived"]),
  email: Schema.optional(Schema.String),
  firstName: Schema.optional(Schema.String),
  lastName: Schema.optional(Schema.String),
  userId: Schema.optional(Long),
  userIdIncludingInactive: Schema.optional(Long),
  teams: Schema.optional(Schema.Array(Schema.Struct(TeamSchema.fields))),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});

export type OwnerObject = Schema.Schema.Type<typeof OwnerObjectSchema>;
