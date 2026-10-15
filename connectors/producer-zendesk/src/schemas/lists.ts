import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import {
  Json,
  Long,
  TextOrJson,
  Timestamp,
  field,
  keyedCustomFields,
  list,
  stringMap,
  version,
} from "./shared";

const common = (object: string) => ({
  id: Long.pipe(field(1, `${object} ID.`)),
  version: version(2, object.toLowerCase()),
  created_at: Timestamp.pipe(field(3, `Time the ${object.toLowerCase()} was created.`)),
  updated_at: Timestamp.pipe(field(4, `Time the ${object.toLowerCase()} was last updated.`)),
});

export const GroupSchema = Schema.Struct({
  ...common("Group"),
  name: Schema.String.pipe(field(5, "Group name.")),
  description: Schema.String.pipe(field(6, "Group description.")),
  default: Schema.Boolean.pipe(field(7, "Whether new tickets go to this group by default.")),
  is_public: Schema.Boolean.pipe(field(8, "Whether all agents can see the group.")),
})
  .annotate({ description: "Zendesk agent groups." })
  .pipe(Iceberg.identifier("id"));

export const BrandSchema = Schema.Struct({
  ...common("Brand"),
  name: Schema.String.pipe(field(5, "Brand name.")),
  subdomain: Schema.String.pipe(field(6, "Brand subdomain.")),
  brand_url: Schema.String.pipe(field(7, "Brand URL.")),
  active: Schema.Boolean.pipe(field(8, "Whether the brand is active.")),
  default: Schema.Boolean.pipe(field(9, "Whether this is the default brand.")),
})
  .annotate({ description: "Zendesk brands." })
  .pipe(Iceberg.identifier("id"));

export const TicketFieldSchema = Schema.Struct({
  ...common("Ticket field"),
  type: Schema.String.pipe(field(5, "Field type, such as text, tagger, or checkbox.")),
  title: Schema.String.pipe(field(6, "Field title shown to agents.")),
  raw_title: Schema.String.pipe(field(7, "Title with any dynamic content placeholder.")),
  active: Schema.Boolean.pipe(field(8, "Whether the field is active.")),
  required: Schema.Boolean.pipe(field(9, "Whether agents must fill it to solve a ticket.")),
  custom_field_options: list(
    101,
    Schema.Struct({
      id: Long.pipe(field(102, "Option ID.")),
      name: Schema.String.pipe(field(103, "Option name.")),
      value: Schema.String.pipe(field(104, "Option value, as stored in `custom_fields`.")),
    }),
  ).pipe(field(10, "Options of a dropdown or multi-select field.")),
})
  .annotate({
    description: "Zendesk ticket fields. Names the IDs in `tickets.custom_fields`.",
  })
  .pipe(Iceberg.identifier("id"));

export const TicketFormSchema = Schema.Struct({
  ...common("Ticket form"),
  name: Schema.String.pipe(field(5, "Form name.")),
  display_name: Schema.String.pipe(field(6, "Form name shown to end users.")),
  active: Schema.Boolean.pipe(field(7, "Whether the form is active.")),
  default: Schema.Boolean.pipe(field(8, "Whether this is the default form.")),
  ticket_field_ids: list(101, Long).pipe(field(9, "Fields on the form, in order.")),
})
  .annotate({ description: "Zendesk ticket forms." })
  .pipe(Iceberg.identifier("id"));

export const CustomStatusSchema = Schema.Struct({
  ...common("Custom status"),
  status_category: Schema.String.pipe(
    field(5, "Status it belongs to: new, open, pending, hold, or solved."),
  ),
  agent_label: Schema.String.pipe(field(6, "Name shown to agents.")),
  end_user_label: Schema.String.pipe(field(7, "Name shown to end users.")),
  active: Schema.Boolean.pipe(field(8, "Whether the status is active.")),
  default: Schema.Boolean.pipe(field(9, "Whether this is the default for its category.")),
})
  .annotate({ description: "Zendesk ticket statuses. Names `tickets.custom_status_id`." })
  .pipe(Iceberg.identifier("id"));

const fieldDefinition = (object: string) => ({
  ...common(`${object} field`),
  key: Schema.String.pipe(field(5, `Key in \`${object.toLowerCase()}_fields\`.`)),
  type: Schema.String.pipe(field(6, "Field type, such as text, dropdown, or checkbox.")),
  title: Schema.String.pipe(field(7, "Field title.")),
  active: Schema.Boolean.pipe(field(8, "Whether the field is active.")),
  position: Long.pipe(field(9, "Position of the field.")),
  custom_field_options: list(
    101,
    Schema.Struct({
      id: Long.pipe(field(102, "Option ID.")),
      name: Schema.String.pipe(field(103, "Option name.")),
      value: Schema.String.pipe(field(104, "Option value.")),
    }),
  ).pipe(field(10, "Options of a dropdown field.")),
});

export const UserFieldSchema = Schema.Struct(fieldDefinition("User"))
  .annotate({
    description: "Zendesk user fields. Names the keys in `users.user_fields`.",
  })
  .pipe(Iceberg.identifier("id"));

export const OrganizationFieldSchema = Schema.Struct(fieldDefinition("Organization"))
  .annotate({
    description:
      "Zendesk organization fields. Names the keys in `organizations.organization_fields`.",
  })
  .pipe(Iceberg.identifier("id"));

export const SlaPolicySchema = Schema.Struct({
  ...common("SLA policy"),
  title: Schema.String.pipe(field(5, "Policy name.")),
  description: Schema.NullOr(Schema.String).pipe(field(6, "Policy description.")),
  position: Long.pipe(field(7, "Order in which policies are matched.")),
  filter: Schema.String.pipe(field(8, "Conditions a ticket must match, as JSON.")),
  policy_metrics: list(
    101,
    Schema.Struct({
      priority: Schema.String.pipe(field(102, "Ticket priority the target applies to.")),
      metric: Schema.String.pipe(field(103, "Metric, such as first_reply_time.")),
      target_in_seconds: Long.pipe(field(104, "Target time in seconds.")),
      business_hours: Schema.Boolean.pipe(field(105, "Whether the target counts business hours.")),
    }),
  ).pipe(field(9, "Targets by priority and metric.")),
})
  .annotate({ description: "Zendesk SLA policies. Names the policies in `ticket_metric_events`." })
  .pipe(Iceberg.identifier("id"));

export const HolidaySchema = Schema.Struct({
  id: Long.pipe(field(105, "Holiday ID.")),
  name: Schema.String.pipe(field(106, "Holiday name.")),
  start_date: Schema.String.pipe(field(107, "First day, as YYYY-MM-DD.")),
  end_date: Schema.String.pipe(field(108, "Last day, as YYYY-MM-DD.")),
});

export const ScheduleSchema = Schema.Struct({
  ...common("Schedule"),
  version: Schema.Date.pipe(
    field(2, "Time the schedule was read. Holidays don't change `updated_at`."),
  ),
  name: Schema.String.pipe(field(5, "Schedule name.")),
  time_zone: Schema.String.pipe(field(6, "Time zone of the schedule.")),
  intervals: list(
    101,
    Schema.Struct({
      start_time: Long.pipe(field(102, "Start, in minutes from Sunday midnight.")),
      end_time: Long.pipe(field(103, "End, in minutes from Sunday midnight.")),
    }),
  ).pipe(field(7, "Weekly business hours.")),
  holidays: list(104, HolidaySchema).pipe(field(8, "Days off.")),
})
  .annotate({ description: "Zendesk business hours schedules, with their holidays." })
  .pipe(Iceberg.identifier("id"));

export const CustomRoleSchema = Schema.Struct({
  ...common("Custom role"),
  name: Schema.String.pipe(field(5, "Role name.")),
  description: Schema.NullOr(Schema.String).pipe(field(6, "Role description.")),
  role_type: Long.pipe(field(7, "Role type. 0 is a custom agent role.")),
  team_member_count: Long.pipe(field(8, "Agents with the role.")),
  configuration: stringMap(101, 102).pipe(
    field(9, "Permissions by name. Values other than text are JSON."),
  ),
})
  .annotate({ description: "Zendesk agent roles. Names `users.custom_role_id`." })
  .pipe(Iceberg.identifier("id"));

export const MacroSchema = Schema.Struct({
  ...common("Macro"),
  title: Schema.String.pipe(field(5, "Macro name.")),
  description: Schema.NullOr(Schema.String).pipe(field(6, "Macro description.")),
  active: Schema.Boolean.pipe(field(7, "Whether the macro is active.")),
  position: Long.pipe(field(8, "Position of the macro.")),
  actions: list(
    101,
    Schema.Struct({
      field: Schema.String.pipe(field(102, "Ticket field the action sets.")),
      value: Schema.NullOr(Schema.String).pipe(field(103, "Value it sets. Lists are JSON.")),
    }),
  ).pipe(field(9, "Changes the macro makes to a ticket.")),
  restriction: Schema.NullOr(Schema.String).pipe(
    field(10, "Who can use the macro, as JSON. Empty for everyone."),
  ),
})
  .annotate({ description: "Zendesk macros: saved replies and ticket changes." })
  .pipe(Iceberg.identifier("id"));

// Zendesk's lists leave out deleted items, so our tables keep them. Older
// tickets still get their names.
const objectOf = <F extends Schema.Struct.Fields>(schema: Schema.Struct<F>) =>
  schema.mapFields((fields) => Struct.omit(fields, ["version"]));

export const GroupObjectSchema = objectOf(GroupSchema);
export const BrandObjectSchema = objectOf(BrandSchema);
export const TicketFieldObjectSchema = objectOf(TicketFieldSchema).mapFields((fields) => ({
  ...fields,
  custom_field_options: Schema.optional(fields.custom_field_options),
}));
export const TicketFormObjectSchema = objectOf(TicketFormSchema);
export const CustomStatusObjectSchema = objectOf(CustomStatusSchema);
const FieldDefinitionObjectSchema = objectOf(UserFieldSchema).mapFields((fields) => ({
  ...fields,
  custom_field_options: Schema.optional(fields.custom_field_options),
}));
export const UserFieldObjectSchema = FieldDefinitionObjectSchema;
export const OrganizationFieldObjectSchema = FieldDefinitionObjectSchema;
export const SlaPolicyObjectSchema = objectOf(SlaPolicySchema).mapFields((fields) => ({
  ...fields,
  filter: Json,
}));
export const ScheduleObjectSchema = objectOf(ScheduleSchema).mapFields((fields) =>
  Struct.omit(fields, ["holidays"]),
);
export const CustomRoleObjectSchema = objectOf(CustomRoleSchema).mapFields((fields) => ({
  ...fields,
  configuration: keyedCustomFields,
}));
export const MacroObjectSchema = objectOf(MacroSchema).mapFields((fields) => ({
  ...fields,
  actions: Schema.Array(Schema.Struct({ field: Schema.String, value: TextOrJson })),
  restriction: TextOrJson,
}));
