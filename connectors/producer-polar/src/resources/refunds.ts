import { Option, Schema } from "effect";

import { MetadataJsonSchema, date, field, nullableDate } from "./shared";

const RefundInputSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique refund identifier.")),
  created_at: date(2, "Time when the refund was created."),
  modified_at: nullableDate(3, "Time when the refund was last changed."),
  status: Schema.Literals(["pending", "succeeded", "failed", "canceled"]).pipe(
    field(4, "Current refund status."),
  ),
  reason: Schema.Literals([
    "duplicate",
    "fraudulent",
    "customer_request",
    "service_disruption",
    "satisfaction_guarantee",
    "dispute_prevention",
    "other",
  ]).pipe(field(5, "Reason for the refund.")),
  amount: Schema.Int.pipe(field(6, "Refunded amount in the smallest currency unit.")),
  tax_amount: Schema.Int.pipe(field(7, "Refunded tax in the smallest currency unit.")),
  currency: Schema.String.pipe(field(8, "Three-letter currency code.")),
  organization_id: Schema.String.pipe(field(9, "Organization that owns the refund.")),
  order_id: Schema.String.pipe(field(10, "Order that was refunded.")),
  subscription_id: Schema.NullOr(Schema.String).pipe(
    field(11, "Subscription linked to the refunded order."),
  ),
  customer_id: Schema.String.pipe(field(12, "Customer who received the refund.")),
  revoke_benefits: Schema.Boolean.pipe(field(13, "Whether the refund revoked benefits.")),
  metadata: MetadataJsonSchema.pipe(field(14, "Refund metadata stored as JSON.")),
});

export const RefundSchema = RefundInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(15, "Time used to order refund changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Refunds in a Polar organization.",
});

export type Refund = Schema.Schema.Type<typeof RefundSchema>;
