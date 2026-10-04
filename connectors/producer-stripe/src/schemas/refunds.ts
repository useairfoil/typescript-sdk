import { Schema, Struct } from "effect";

import { Long, Metadata, UnixTime, field, version } from "./shared";

export const RefundSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique refund identifier.")),
  version: version(2),
  created: UnixTime.pipe(field(3, "Time when the refund was created.")),
  amount: Long.pipe(field(4, "Refunded amount, in the smallest currency unit.")),
  currency: Schema.String.pipe(field(5, "Three-letter currency code, in lowercase.")),
  status: Schema.NullOr(Schema.String).pipe(
    field(6, "Status: pending, requires_action, succeeded, failed, or canceled."),
  ),
  pending_reason: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(7, "Why the refund is pending."),
  ),
  reason: Schema.NullOr(Schema.String).pipe(field(8, "Why the refund was made.")),
  failure_reason: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(9, "Why the refund failed."),
  ),
  charge: Schema.NullOr(Schema.String).pipe(field(10, "Charge that was refunded.")),
  payment_intent: Schema.NullOr(Schema.String).pipe(field(11, "Payment intent that was refunded.")),
  customer: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(12, "Customer of the refund."),
  ),
  customer_account: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(13, "Account that represents the customer, for Accounts v2."),
  ),
  balance_transaction: Schema.NullOr(Schema.String).pipe(
    field(14, "Balance transaction for the refund."),
  ),
  metadata: Metadata.pipe(field(15, "Key-value pairs set on the refund.")),
}).annotate({
  description: "Refunds in a Stripe account.",
});

export type Refund = Schema.Schema.Type<typeof RefundSchema>;

export const RefundObjectSchema = RefundSchema.mapFields(Struct.omit(["version"]));

export type RefundObject = Schema.Schema.Type<typeof RefundObjectSchema>;
