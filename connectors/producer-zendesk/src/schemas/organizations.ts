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

export const OrganizationSchema = Schema.Struct({
  id: Long.pipe(field(1, "Organization ID.")),
  version: version(2, "organization"),
  _deleted: deleted(3, "organization"),
  created_at: Timestamp.pipe(field(4, "Time the organization was created.")),
  updated_at: Timestamp.pipe(field(5, "Time the organization was last updated.")),
  name: Schema.String.pipe(field(6, "Organization name. Zendesk renames deleted ones.")),
  external_id: Schema.NullOr(Schema.String).pipe(field(7, "ID in another system.")),
  group_id: Schema.NullOr(Long).pipe(field(8, "Group that gets new tickets from its users.")),
  domain_names: list(101, Schema.String).pipe(field(9, "Email domains of its users.")),
  tags: list(102, Schema.String).pipe(field(10, "Organization tags.")),
  organization_fields: stringMap(103, 104).pipe(
    field(11, "Custom organization field values by field key. Lists are JSON."),
  ),
}).annotate({ description: "Zendesk organizations, usually customer companies." });

export type Organization = Schema.Schema.Type<typeof OrganizationSchema>;

export const OrganizationObjectSchema = OrganizationSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "_deleted", "organization_fields"]),
  deleted_at: Schema.NullOr(Timestamp),
  organization_fields: keyedCustomFields,
}));

export type OrganizationObject = Schema.Schema.Type<typeof OrganizationObjectSchema>;
