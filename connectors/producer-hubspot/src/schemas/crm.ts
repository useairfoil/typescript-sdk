import { Schema } from "effect";

import { deleted, field, list, stringMap, version } from "./shared";

// The first six fields and the association lists keep the same IDs in every
// CRM table.
const baseFields = (object: string) => ({
  id: Schema.String.pipe(field(1, `HubSpot record ID of the ${object}.`)),
  version: version(2),
  created_at: Schema.Date.pipe(field(3, `Time the ${object} was created.`)),
  updated_at: Schema.Date.pipe(
    field(
      4,
      `Time HubSpot last changed the ${object}. Calculated properties and associations can change without it.`,
    ),
  ),
  properties: stringMap(101, 102).pipe(
    field(5, "Every non-empty, non-sensitive property, as HubSpot returns it, by internal name."),
  ),
  _deleted: deleted(6, object),
});

const ids = (fieldId: number, elementId: number, object: string) =>
  list(elementId, Schema.String).pipe(field(fieldId, `IDs of the associated ${object}.`));

const company_ids = ids(7, 103, "companies");
const contact_ids = ids(8, 104, "contacts");
const deal_ids = ids(9, 105, "deals");
const ticket_ids = ids(10, 106, "tickets");

const activityFields = (object: string) => ({
  ...baseFields(object),
  company_ids,
  contact_ids,
  deal_ids,
  ticket_ids,
});

export const ContactSchema = Schema.Struct({ ...baseFields("contact"), company_ids }).annotate({
  description: "HubSpot contacts.",
});
export type Contact = Schema.Schema.Type<typeof ContactSchema>;

export const CompanySchema = Schema.Struct(baseFields("company")).annotate({
  description: "HubSpot companies. Their contacts and deals are on those tables.",
});
export type Company = Schema.Schema.Type<typeof CompanySchema>;

export const DealSchema = Schema.Struct({
  ...baseFields("deal"),
  company_ids,
  contact_ids,
}).annotate({ description: "HubSpot deals." });
export type Deal = Schema.Schema.Type<typeof DealSchema>;

export const TicketSchema = Schema.Struct({
  ...baseFields("ticket"),
  company_ids,
  contact_ids,
  deal_ids,
}).annotate({ description: "HubSpot tickets." });
export type Ticket = Schema.Schema.Type<typeof TicketSchema>;

export const CallSchema = Schema.Struct(activityFields("call")).annotate({
  description: "Calls logged in HubSpot.",
});
export type Call = Schema.Schema.Type<typeof CallSchema>;

export const EmailSchema = Schema.Struct(activityFields("email")).annotate({
  description: "One-to-one emails logged in HubSpot.",
});
export type Email = Schema.Schema.Type<typeof EmailSchema>;

export const MeetingSchema = Schema.Struct(activityFields("meeting")).annotate({
  description: "Meetings logged in HubSpot.",
});
export type Meeting = Schema.Schema.Type<typeof MeetingSchema>;

export const NoteSchema = Schema.Struct(activityFields("note")).annotate({
  description: "Notes on HubSpot records.",
});
export type Note = Schema.Schema.Type<typeof NoteSchema>;

export const TaskSchema = Schema.Struct(activityFields("task")).annotate({
  description: "HubSpot tasks.",
});
export type Task = Schema.Schema.Type<typeof TaskSchema>;

export const LineItemSchema = Schema.Struct({ ...baseFields("line item"), deal_ids }).annotate({
  description: "Line items on HubSpot deals. The product is `hs_product_id` in `properties`.",
});
export type LineItem = Schema.Schema.Type<typeof LineItemSchema>;

export const ProductSchema = Schema.Struct(baseFields("product")).annotate({
  description: "HubSpot product library.",
});
export type Product = Schema.Schema.Type<typeof ProductSchema>;
