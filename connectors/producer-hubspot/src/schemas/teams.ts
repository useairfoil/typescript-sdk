import { Iceberg } from "@useairfoil/connector-kit";
import { Schema } from "effect";

import { field, list, version } from "./shared";

const MemberSchema = Schema.Struct({
  user_id: Schema.String.pipe(field(102, "HubSpot user ID, as used in `owners.user_id`.")),
  type: Schema.String.pipe(field(103, "DEFAULT for the user's main team, or EXTRA.")),
});

export const TeamSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Team ID, as used in `hubspot_team_id`.")),
  version: version(2),
  name: Schema.String.pipe(field(3, "Team name.")),
  parent_team_id: Schema.optional(Schema.String).pipe(field(4, "ID of the parent team.")),
  members: list(101, MemberSchema).pipe(field(5, "Users in the team.")),
})
  .annotate({ description: "HubSpot teams and their users." })
  .pipe(Iceberg.identifier("id"));

export type Team = Schema.Schema.Type<typeof TeamSchema>;

export const TeamObjectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  parentTeamId: Schema.optional(Schema.NullOr(Schema.String)),
});

export const TeamMemberObjectSchema = Schema.Struct({ userId: Schema.String, type: Schema.String });
