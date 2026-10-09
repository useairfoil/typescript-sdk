import { Resource } from "@useairfoil/connector-kit";
import { Effect, Schema, Struct } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  type MetricSet,
  MetricSetSchema,
  type Ticket,
  type TicketObject,
  TicketObjectSchema,
  TicketSchema,
} from "../schemas/tickets";
import { cursorExport } from "./exports";

const TicketPageSchema = Schema.Struct({
  tickets: Schema.Array(TicketObjectSchema),
  metric_sets: Schema.optional(Schema.Array(MetricSetSchema)),
  after_cursor: Schema.NullOr(Schema.String),
  end_of_stream: Schema.Boolean,
});

// Zendesk can restore a deleted ticket, so other rows send `_deleted: false`.
const toRow = (
  { generated_timestamp, ...rest }: TicketObject,
  metrics: MetricSet | undefined,
): Ticket => ({
  ...rest,
  version: generated_timestamp,
  _deleted: rest.status === "deleted",
  metrics: metrics === undefined ? null : Struct.omit(metrics, ["ticket_id"]),
});

export const makeTickets = (client: ZendeskClientService) =>
  Resource.entity({
    name: "tickets",
    rowSchema: TicketSchema,
    key: "id",
    version: "version",
    ...cursorExport({
      client,
      path: "/incremental/tickets/cursor",
      schema: TicketPageSchema,
      params: { include: "metric_sets" },
      rows: (page) => {
        const metrics = new Map((page.metric_sets ?? []).map((set) => [set.ticket_id, set]));
        return Effect.succeed(page.tickets.map((ticket) => toRow(ticket, metrics.get(ticket.id))));
      },
    }),
  });
