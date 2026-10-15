import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, field, version } from "./shared";

export const SatisfactionRatingSchema = Schema.Struct({
  id: Long.pipe(field(1, "Rating ID.")),
  version: version(2, "rating"),
  created_at: Timestamp.pipe(field(3, "Time the rating was given.")),
  updated_at: Timestamp.pipe(field(4, "Time the rating was last updated.")),
  ticket_id: Schema.NullOr(Long).pipe(field(5, "Ticket that was rated.")),
  requester_id: Long.pipe(field(6, "User who rated.")),
  assignee_id: Schema.NullOr(Long).pipe(field(7, "Agent on the ticket.")),
  group_id: Schema.NullOr(Long).pipe(field(8, "Group of the ticket.")),
  score: Schema.String.pipe(field(9, "offered, unoffered, good, or bad.")),
  comment: Schema.NullOr(Schema.String).pipe(field(10, "Comment with the rating.")),
  reason: Schema.NullOr(Schema.String).pipe(field(11, "Reason picked for a bad rating.")),
  reason_id: Schema.NullOr(Long).pipe(field(12, "ID of the reason.")),
})
  .annotate({
    description:
      "Zendesk satisfaction ratings, from the legacy CSAT. A new score is a new row; the latest per ticket counts.",
  })
  .pipe(Iceberg.identifier("id"));

export type SatisfactionRating = Schema.Schema.Type<typeof SatisfactionRatingSchema>;

export const SatisfactionRatingObjectSchema = SatisfactionRatingSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "reason", "reason_id"]),
  reason: Schema.optional(fields.reason),
  reason_id: Schema.optional(fields.reason_id),
}));

export type SatisfactionRatingObject = Schema.Schema.Type<typeof SatisfactionRatingObjectSchema>;
