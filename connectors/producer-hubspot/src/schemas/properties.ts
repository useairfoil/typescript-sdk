import { Iceberg } from "@useairfoil/connector-kit";
import { Schema } from "effect";

import { Long, Timestamp, field, list, version } from "./shared";

const OptionSchema = Schema.Struct({
  label: Schema.String.pipe(field(102, "Option name.")),
  value: Schema.String.pipe(field(103, "Value stored in `properties`.")),
  display_order: Long.pipe(field(104, "Position of the option.")),
  hidden: Schema.Boolean.pipe(field(105, "Whether the option is hidden in forms.")),
});

export const PropertySchema = Schema.Struct({
  key: Schema.String.pipe(field(1, "Object type and property name, such as `deals:dealstage`.")),
  version: version(2),
  object_type: Schema.String.pipe(
    field(3, "Table the property belongs to, or a custom object type ID such as `2-123`."),
  ),
  name: Schema.String.pipe(field(4, "Internal name, the key in `properties`.")),
  label: Schema.String.pipe(field(5, "Property name in HubSpot.")),
  type: Schema.String.pipe(field(6, "Value type, such as string, number, date, or enumeration.")),
  field_type: Schema.String.pipe(field(7, "Input type, such as text, select, or checkbox.")),
  description: Schema.String.pipe(field(8, "Property description.")),
  group_name: Schema.String.pipe(field(9, "Property group.")),
  options: list(101, OptionSchema).pipe(
    field(
      10,
      "Options of an enumeration. Empty when they come from elsewhere, such as pipeline stages.",
    ),
  ),
  calculated: Schema.Boolean.pipe(field(11, "Whether HubSpot calculates the value.")),
  hidden: Schema.Boolean.pipe(field(12, "Whether the property is hidden in HubSpot.")),
  hubspot_defined: Schema.Boolean.pipe(field(13, "Whether HubSpot created the property.")),
  archived: Schema.Boolean.pipe(field(14, "Whether the property was removed.")),
  created_at: Schema.optional(Schema.Date).pipe(field(15, "Time the property was created.")),
  updated_at: Schema.optional(Schema.Date).pipe(field(16, "Time the property last changed.")),
})
  .annotate({ description: "Property definitions that name the keys and values in `properties`." })
  .pipe(Iceberg.identifier("key"));

export type Property = Schema.Schema.Type<typeof PropertySchema>;

export const PropertyObjectSchema = Schema.Struct({
  name: Schema.String,
  label: Schema.String,
  type: Schema.String,
  fieldType: Schema.String,
  description: Schema.String,
  groupName: Schema.String,
  options: Schema.Array(
    Schema.Struct({
      label: Schema.String,
      value: Schema.String,
      displayOrder: Long,
      hidden: Schema.Boolean,
    }),
  ),
  calculated: Schema.Boolean,
  hidden: Schema.Boolean,
  hubspotDefined: Schema.optional(Schema.Boolean),
  archived: Schema.optional(Schema.Boolean),
  createdAt: Schema.optional(Timestamp),
  updatedAt: Schema.optional(Timestamp),
});

export type PropertyObject = Schema.Schema.Type<typeof PropertyObjectSchema>;
