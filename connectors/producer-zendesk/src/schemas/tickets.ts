import { Schema, Struct } from "effect";

import {
  Long,
  Timestamp,
  UnixSeconds,
  deleted,
  field,
  list,
  stringMap,
  ticketCustomFields,
} from "./shared";

const minutes = (baseId: number, description: string) =>
  Schema.Struct({
    calendar: Schema.NullOr(Long).pipe(field(baseId, "Minutes in calendar hours.")),
    business: Schema.NullOr(Long).pipe(field(baseId + 1, "Minutes in business hours.")),
  }).pipe(field(baseId + 2, description));

const MetricsSchema = Schema.Struct({
  replies: Long.pipe(field(110, "Number of agent replies.")),
  reopens: Long.pipe(field(111, "Number of times the ticket was reopened.")),
  assignee_stations: Long.pipe(field(112, "Number of assignees the ticket had.")),
  group_stations: Long.pipe(field(113, "Number of groups the ticket had.")),
  reply_time_in_minutes: minutes(114, "Time to the first agent reply."),
  first_resolution_time_in_minutes: minutes(117, "Time to the first solve."),
  full_resolution_time_in_minutes: minutes(120, "Time to the last solve."),
  agent_wait_time_in_minutes: minutes(123, "Time spent pending, waiting on the agent."),
  requester_wait_time_in_minutes: minutes(126, "Time spent waiting on the requester."),
  on_hold_time_in_minutes: minutes(129, "Time spent on hold."),
  assigned_at: Schema.NullOr(Timestamp).pipe(field(132, "Time of the last assignment.")),
  initially_assigned_at: Schema.NullOr(Timestamp).pipe(field(133, "Time of the first assignment.")),
  solved_at: Schema.NullOr(Timestamp).pipe(field(134, "Time the ticket was last solved.")),
  latest_comment_added_at: Schema.NullOr(Timestamp).pipe(field(135, "Time of the latest comment.")),
  status_updated_at: Schema.NullOr(Timestamp).pipe(field(136, "Time the status last changed.")),
});

export const TicketSchema = Schema.Struct({
  id: Long.pipe(field(1, "Ticket ID.")),
  version: Schema.Date.pipe(
    field(2, "Time Zendesk last changed the ticket, system updates included."),
  ),
  _deleted: deleted(3, "ticket"),
  created_at: Timestamp.pipe(field(4, "Time the ticket was created.")),
  updated_at: Timestamp.pipe(field(5, "Time someone last updated the ticket.")),
  subject: Schema.NullOr(Schema.String).pipe(field(6, "Ticket subject.")),
  description: Schema.NullOr(Schema.String).pipe(field(7, "Text of the first comment.")),
  status: Schema.String.pipe(
    field(8, "Status: new, open, pending, hold, solved, closed, or deleted."),
  ),
  custom_status_id: Schema.NullOr(Long).pipe(field(9, "Custom status ID, in `custom_statuses`.")),
  priority: Schema.NullOr(Schema.String).pipe(field(10, "Priority: low, normal, high, or urgent.")),
  type: Schema.NullOr(Schema.String).pipe(field(11, "Type: problem, incident, question, or task.")),
  via: Schema.Struct({
    channel: Schema.String.pipe(field(101, "Channel, such as email, web, or api.")),
  }).pipe(field(12, "How the ticket was created.")),
  requester_id: Schema.NullOr(Long).pipe(field(13, "User who asked for help.")),
  submitter_id: Schema.NullOr(Long).pipe(field(14, "User who created the ticket.")),
  assignee_id: Schema.NullOr(Long).pipe(field(15, "Agent assigned to the ticket.")),
  organization_id: Schema.NullOr(Long).pipe(field(16, "Organization of the requester.")),
  group_id: Schema.NullOr(Long).pipe(field(17, "Group assigned to the ticket.")),
  brand_id: Schema.NullOr(Long).pipe(field(18, "Brand of the ticket.")),
  ticket_form_id: Schema.NullOr(Long).pipe(field(19, "Form of the ticket.")),
  problem_id: Schema.NullOr(Long).pipe(field(20, "Problem ticket this incident is linked to.")),
  due_at: Schema.NullOr(Timestamp).pipe(field(21, "Due time of a task ticket.")),
  external_id: Schema.NullOr(Schema.String).pipe(field(22, "ID in another system.")),
  is_public: Schema.Boolean.pipe(field(23, "Whether the ticket has a public comment.")),
  satisfaction_rating: Schema.NullOr(
    Schema.Struct({
      score: Schema.String.pipe(field(102, "Score: offered, unoffered, good, or bad.")),
      comment: Schema.optional(Schema.NullOr(Schema.String)).pipe(
        field(103, "Comment left with the rating."),
      ),
    }),
  ).pipe(field(24, "Customer satisfaction. The full answers are in `survey_responses`.")),
  tags: list(104, Schema.String).pipe(field(25, "Ticket tags.")),
  custom_fields: stringMap(105, 106).pipe(
    field(26, "Custom field values by field ID, in `ticket_fields`. Lists are JSON."),
  ),
  metrics: Schema.NullOr(MetricsSchema).pipe(field(27, "Reply, wait, and resolution times.")),
}).annotate({ description: "Zendesk tickets, with their metrics." });

export type Ticket = Schema.Schema.Type<typeof TicketSchema>;

export const TicketObjectSchema = TicketSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "_deleted", "custom_fields", "metrics"]),
  generated_timestamp: UnixSeconds,
  custom_fields: ticketCustomFields,
}));

export type TicketObject = Schema.Schema.Type<typeof TicketObjectSchema>;

export const MetricSetSchema = Schema.Struct({ ticket_id: Long, ...MetricsSchema.fields });

export type MetricSet = Schema.Schema.Type<typeof MetricSetSchema>;
