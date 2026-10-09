import { Schema, Struct } from "effect";

import {
  Long,
  Timestamp,
  deleted,
  field,
  keyedCustomFields,
  list,
  stringMap,
  version,
} from "./shared";

export const UserSchema = Schema.Struct({
  id: Long.pipe(field(1, "User ID.")),
  version: version(2, "user"),
  _deleted: deleted(3, "user"),
  created_at: Timestamp.pipe(field(4, "Time the user was created.")),
  updated_at: Timestamp.pipe(field(5, "Time the user was last updated.")),
  name: Schema.String.pipe(field(6, "User name.")),
  email: Schema.NullOr(Schema.String).pipe(field(7, "Primary email. Empty for some end users.")),
  role: Schema.String.pipe(field(8, "Role: end-user, agent, or admin.")),
  custom_role_id: Schema.NullOr(Long).pipe(field(9, "Custom agent role ID.")),
  organization_id: Schema.NullOr(Long).pipe(field(10, "Default organization of the user.")),
  default_group_id: Schema.NullOr(Long).pipe(field(11, "Default group of an agent.")),
  suspended: Schema.Boolean.pipe(field(12, "Whether the user is suspended.")),
  verified: Schema.Boolean.pipe(field(13, "Whether the primary identity is verified.")),
  locale: Schema.NullOr(Schema.String).pipe(field(14, "Locale, such as en-US.")),
  time_zone: Schema.NullOr(Schema.String).pipe(field(15, "Time zone name.")),
  external_id: Schema.NullOr(Schema.String).pipe(field(16, "ID in another system.")),
  last_login_at: Schema.NullOr(Timestamp).pipe(field(17, "Time of the last sign-in.")),
  tags: list(101, Schema.String).pipe(field(18, "User tags.")),
  user_fields: stringMap(102, 103).pipe(
    field(19, "Custom user field values by field key. Lists are JSON."),
  ),
}).annotate({ description: "Zendesk users: end users, agents, and admins." });

export type User = Schema.Schema.Type<typeof UserSchema>;

export const UserObjectSchema = UserSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "_deleted", "user_fields"]),
  // `false` once the user is deleted.
  active: Schema.Boolean,
  user_fields: keyedCustomFields,
}));

export type UserObject = Schema.Schema.Type<typeof UserObjectSchema>;
