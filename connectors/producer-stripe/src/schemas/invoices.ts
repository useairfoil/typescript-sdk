import { Schema, Struct } from "effect";

import { Long, Metadata, UnixTime, address, deleted, field, shipping, version } from "./shared";

export const InvoiceSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique invoice identifier.")),
  version: version(2),
  created: UnixTime.pipe(field(3, "Time when the invoice was created.")),
  livemode: Schema.Boolean.pipe(field(4, "Whether the invoice exists in live mode.")),
  // Stripe documents this as required, but accounts can use customer_account instead.
  customer: Schema.NullOr(Schema.String).pipe(field(5, "Customer who is billed.")),
  customer_account: Schema.NullOr(Schema.String).pipe(
    field(6, "Account that represents the customer, for Accounts v2."),
  ),
  parent: Schema.NullOr(
    Schema.Struct({
      type: Schema.String.pipe(
        field(100, "What created the invoice, such as subscription_details."),
      ),
      subscription_details: Schema.NullOr(
        Schema.Struct({
          subscription: Schema.String.pipe(field(102, "Subscription that created the invoice.")),
        }),
      ).pipe(field(101, "Set when a subscription created the invoice.")),
    }),
  ).pipe(field(7, "Object that created the invoice.")),
  status: Schema.NullOr(Schema.String).pipe(
    field(8, "Status: draft, open, paid, uncollectible, or void."),
  ),
  number: Schema.NullOr(Schema.String).pipe(field(9, "Invoice number shown to the customer.")),
  currency: Schema.String.pipe(field(10, "Three-letter currency code, in lowercase.")),
  subtotal: Long.pipe(field(11, "Total before invoice-level discounts and exclusive tax.")),
  total: Long.pipe(field(12, "Total after discounts and taxes.")),
  total_excluding_tax: Schema.NullOr(Long).pipe(field(13, "Total after discounts, without tax.")),
  amount_due: Long.pipe(field(14, "Amount due now.")),
  amount_paid: Long.pipe(field(15, "Amount paid.")),
  amount_remaining: Long.pipe(field(16, "Amount due minus amount paid.")),
  amount_overpaid: Long.pipe(field(17, "Overpaid amount, credited to the customer balance.")),
  attempt_count: Long.pipe(field(18, "Payment attempts made by the retry schedule.")),
  billing_reason: Schema.NullOr(Schema.String).pipe(field(19, "Why the invoice was created.")),
  collection_method: Schema.String.pipe(
    field(20, "How the invoice is paid: charge_automatically or send_invoice."),
  ),
  due_date: Schema.NullOr(UnixTime).pipe(field(21, "Due date. Only set for send_invoice.")),
  period_start: UnixTime.pipe(field(22, "Earliest time items can belong to the invoice.")),
  period_end: UnixTime.pipe(field(23, "Latest time items can belong to the invoice.")),
  effective_at: Schema.NullOr(UnixTime).pipe(field(24, "Date of issue.")),
  status_transitions: Schema.Struct({
    finalized_at: Schema.NullOr(UnixTime).pipe(field(110, "Time when the invoice was finalized.")),
    paid_at: Schema.NullOr(UnixTime).pipe(field(111, "Time when the invoice was paid.")),
    voided_at: Schema.NullOr(UnixTime).pipe(field(112, "Time when the invoice was voided.")),
    marked_uncollectible_at: Schema.NullOr(UnixTime).pipe(
      field(113, "Time when the invoice was marked uncollectible."),
    ),
  }).pipe(field(25, "Times of status changes.")),
  metadata: Metadata.pipe(field(26, "Key-value pairs set on the invoice.")),
  _deleted: deleted(27),
  test_clock: Schema.NullOr(Schema.String).pipe(
    field(28, "Test clock the invoice belongs to. Sandbox only."),
  ),
  customer_email: Schema.NullOr(Schema.String).pipe(
    field(29, "Customer email. Fixed when the invoice is finalized."),
  ),
  customer_name: Schema.NullOr(Schema.String).pipe(
    field(30, "Customer name. Fixed when the invoice is finalized."),
  ),
  customer_phone: Schema.NullOr(Schema.String).pipe(
    field(31, "Customer phone number. Fixed when the invoice is finalized."),
  ),
  customer_address: Schema.NullOr(address(120)).pipe(
    field(32, "Customer address. Fixed when the invoice is finalized."),
  ),
  customer_shipping: Schema.NullOr(shipping(130)).pipe(
    field(33, "Customer shipping details. Fixed when the invoice is finalized."),
  ),
}).annotate({
  description: "Invoices in a Stripe account. Deleted drafts are marked deleted.",
});

export type Invoice = Schema.Schema.Type<typeof InvoiceSchema>;

export const InvoiceObjectSchema = InvoiceSchema.mapFields(Struct.omit(["version", "_deleted"]));

export type InvoiceObject = Schema.Schema.Type<typeof InvoiceObjectSchema>;
