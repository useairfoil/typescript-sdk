import { Schema, Struct } from "effect";

import { Long, Metadata, UnixTime, field, version } from "./shared";

export const SubscriptionItemSchema = Schema.Struct({
  id: Schema.String.pipe(field(301, "Unique subscription item identifier.")),
  created: UnixTime.pipe(field(302, "Time when the item was created.")),
  price: Schema.Struct({
    id: Schema.String.pipe(field(304, "Price identifier.")),
    product: Schema.String.pipe(field(305, "Product the price belongs to.")),
  }).pipe(field(303, "Price of the item.")),
  // Metered items have no quantity.
  quantity: Schema.optional(Long).pipe(field(306, "Quantity billed for the item.")),
  current_period_start: UnixTime.pipe(field(307, "Start of the item's current billing period.")),
  current_period_end: UnixTime.pipe(field(308, "End of the item's current billing period.")),
});

export type SubscriptionItem = Schema.Schema.Type<typeof SubscriptionItemSchema>;

export const SubscriptionSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique subscription identifier.")),
  version: version(2),
  created: UnixTime.pipe(field(3, "Time when the subscription was created.")),
  livemode: Schema.Boolean.pipe(field(4, "Whether the subscription exists in live mode.")),
  // Stripe documents this as required, but accounts can use customer_account instead.
  customer: Schema.NullOr(Schema.String).pipe(field(5, "Customer who owns the subscription.")),
  customer_account: Schema.NullOr(Schema.String).pipe(
    field(6, "Account that represents the customer, for Accounts v2."),
  ),
  status: Schema.String.pipe(
    field(7, "Status, such as trialing, active, past_due, canceled, unpaid, or paused."),
  ),
  currency: Schema.String.pipe(field(8, "Three-letter currency code, in lowercase.")),
  collection_method: Schema.String.pipe(
    field(9, "How invoices are paid: charge_automatically or send_invoice."),
  ),
  start_date: UnixTime.pipe(field(10, "Time when the subscription started. Can be backdated.")),
  billing_cycle_anchor: UnixTime.pipe(field(11, "Reference point for billing dates.")),
  cancel_at: Schema.NullOr(UnixTime).pipe(field(12, "Time when the subscription will cancel.")),
  cancel_at_period_end: Schema.Boolean.pipe(
    field(13, "Whether the subscription cancels at the end of the period."),
  ),
  canceled_at: Schema.NullOr(UnixTime).pipe(field(14, "Time when cancellation was requested.")),
  ended_at: Schema.NullOr(UnixTime).pipe(field(15, "Time when the subscription ended.")),
  trial_start: Schema.NullOr(UnixTime).pipe(field(16, "Start of the trial.")),
  trial_end: Schema.NullOr(UnixTime).pipe(field(17, "End of the trial.")),
  days_until_due: Schema.NullOr(Long).pipe(
    field(18, "Days to pay invoices. Only set for send_invoice."),
  ),
  default_payment_method: Schema.NullOr(Schema.String).pipe(
    field(19, "Default payment method of the subscription."),
  ),
  latest_invoice: Schema.NullOr(Schema.String).pipe(field(20, "Most recent invoice.")),
  schedule: Schema.NullOr(Schema.String).pipe(field(21, "Subscription schedule, if any.")),
  description: Schema.NullOr(Schema.String).pipe(field(22, "Description shown to the customer.")),
  cancellation_details: Schema.NullOr(
    Schema.Struct({
      reason: Schema.NullOr(Schema.String).pipe(field(100, "Why the subscription was canceled.")),
      feedback: Schema.NullOr(Schema.String).pipe(
        field(101, "Reason the customer picked when canceling."),
      ),
      comment: Schema.NullOr(Schema.String).pipe(
        field(102, "Free-text comment from the customer."),
      ),
    }),
  ).pipe(field(23, "Why the subscription was canceled.")),
  pause_collection: Schema.NullOr(
    Schema.Struct({
      behavior: Schema.String.pipe(field(110, "What happens to invoices while paused.")),
      resumes_at: Schema.NullOr(UnixTime).pipe(field(111, "Time when collection resumes.")),
    }),
  ).pipe(field(24, "Paused payment collection. Not the same as status paused.")),
  items: Schema.Array(SubscriptionItemSchema.annotate({ fieldId: 300 })).pipe(
    field(25, "All items of the subscription."),
  ),
  metadata: Metadata.pipe(field(26, "Key-value pairs set on the subscription.")),
  test_clock: Schema.NullOr(Schema.String).pipe(
    field(27, "Test clock the subscription belongs to. Sandbox only."),
  ),
}).annotate({
  description: "Subscriptions in a Stripe account, including canceled ones.",
});

export type Subscription = Schema.Schema.Type<typeof SubscriptionSchema>;

export const SubscriptionObjectSchema = SubscriptionSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version"]),
  items: Schema.Struct({
    data: Schema.Array(SubscriptionItemSchema),
    has_more: Schema.Boolean,
  }),
}));

export type SubscriptionObject = Schema.Schema.Type<typeof SubscriptionObjectSchema>;

export type SubscriptionRow = Omit<Subscription, "version">;
