import { Schema, Struct } from "effect";

import { Long, Timestamp, field, list, version } from "./shared";

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
}).annotate({ description: "Zendesk agent groups." });

export const BrandSchema = Schema.Struct({
  ...common("Brand"),
  name: Schema.String.pipe(field(5, "Brand name.")),
  subdomain: Schema.String.pipe(field(6, "Brand subdomain.")),
  brand_url: Schema.String.pipe(field(7, "Brand URL.")),
  active: Schema.Boolean.pipe(field(8, "Whether the brand is active.")),
  default: Schema.Boolean.pipe(field(9, "Whether this is the default brand.")),
}).annotate({ description: "Zendesk brands." });

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
}).annotate({
  description: "Zendesk ticket fields. Names the IDs in `tickets.custom_fields`.",
});

export const TicketFormSchema = Schema.Struct({
  ...common("Ticket form"),
  name: Schema.String.pipe(field(5, "Form name.")),
  display_name: Schema.String.pipe(field(6, "Form name shown to end users.")),
  active: Schema.Boolean.pipe(field(7, "Whether the form is active.")),
  default: Schema.Boolean.pipe(field(8, "Whether this is the default form.")),
  ticket_field_ids: list(101, Long).pipe(field(9, "Fields on the form, in order.")),
}).annotate({ description: "Zendesk ticket forms." });

export const CustomStatusSchema = Schema.Struct({
  ...common("Custom status"),
  status_category: Schema.String.pipe(
    field(5, "Status it belongs to: new, open, pending, hold, or solved."),
  ),
  agent_label: Schema.String.pipe(field(6, "Name shown to agents.")),
  end_user_label: Schema.String.pipe(field(7, "Name shown to end users.")),
  active: Schema.Boolean.pipe(field(8, "Whether the status is active.")),
  default: Schema.Boolean.pipe(field(9, "Whether this is the default for its category.")),
}).annotate({ description: "Zendesk ticket statuses. Names `tickets.custom_status_id`." });

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
