import { Option, Schema } from "effect";

import { CustomFieldDataJsonSchema, MetadataJsonSchema, date, field, nullableDate } from "./shared";

const SubscriptionInputSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique subscription identifier.")),
  created_at: date(2, "Time when the subscription was created."),
  modified_at: nullableDate(3, "Time when the subscription was last changed."),
  amount: Schema.Int.pipe(field(4, "Subscription amount in the smallest currency unit.")),
  currency: Schema.String.pipe(field(5, "Three-letter currency code.")),
  recurring_interval: Schema.Literals(["day", "week", "month", "year"]).pipe(
    field(6, "Unit used for recurring billing."),
  ),
  recurring_interval_count: Schema.Int.pipe(field(7, "Number of recurring billing intervals.")),
  status: Schema.Literals([
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ]).pipe(field(8, "Current subscription status.")),
  current_period_start: date(9, "Start of the current billing period."),
  current_period_end: date(10, "End of the current billing period."),
  current_meter_period_start: nullableDate(11, "Start of the current metered period."),
  current_meter_period_end: nullableDate(12, "End of the current metered period."),
  trial_start: nullableDate(13, "Time when the trial started."),
  trial_end: nullableDate(14, "Time when the trial ends."),
  cancel_at_period_end: Schema.Boolean.pipe(
    field(15, "Whether the subscription will cancel at the period end."),
  ),
  canceled_at: nullableDate(16, "Time when the subscription was canceled."),
  started_at: nullableDate(17, "Time when the subscription started."),
  ends_at: nullableDate(18, "Time when the subscription is set to end."),
  ended_at: nullableDate(19, "Time when the subscription ended."),
  pause_at_period_end: Schema.Boolean.pipe(
    field(20, "Whether the subscription will pause at the period end."),
  ),
  paused_at: nullableDate(21, "Time when the subscription was paused."),
  resumes_at: nullableDate(22, "Time when the subscription resumes."),
  past_due_at: Schema.optional(Schema.NullOr(Schema.DateFromString)).pipe(
    field(23, "Time when the subscription became past due."),
  ),
  customer_id: Schema.String.pipe(field(24, "Customer linked to the subscription.")),
  product_id: Schema.String.pipe(field(25, "Product linked to the subscription.")),
  discount_id: Schema.NullOr(Schema.String).pipe(field(26, "Discount linked to the subscription.")),
  checkout_id: Schema.NullOr(Schema.String).pipe(
    field(27, "Checkout that created the subscription."),
  ),
  customer_cancellation_reason: Schema.NullOr(
    Schema.Literals([
      "customer_service",
      "low_quality",
      "missing_features",
      "switched_service",
      "too_complex",
      "too_expensive",
      "unused",
      "other",
    ]),
  ).pipe(field(28, "Reason selected when the subscription was canceled.")),
  customer_cancellation_comment: Schema.NullOr(Schema.String).pipe(
    field(29, "Comment entered when the subscription was canceled."),
  ),
  seats: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(30, "Number of subscription seats."),
  ),
  units: Schema.NullOr(Schema.Int).pipe(field(31, "Number of subscription units.")),
  metadata: MetadataJsonSchema.pipe(field(32, "Subscription metadata stored as JSON.")),
  custom_field_data: Schema.optional(CustomFieldDataJsonSchema).pipe(
    field(33, "Subscription custom fields stored as JSON."),
  ),
});

export const SubscriptionSchema = SubscriptionInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(34, "Time used to order subscription changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Subscriptions in a Polar organization.",
});

export type Subscription = Schema.Schema.Type<typeof SubscriptionSchema>;
