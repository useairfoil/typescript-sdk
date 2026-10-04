import { Schema, Struct } from "effect";

import { Long, Metadata, UnixTime, address, deleted, field, shipping, version } from "./shared";

export const CustomerSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique customer identifier.")),
  version: version(2),
  created: UnixTime.pipe(field(3, "Time when the customer was created.")),
  livemode: Schema.Boolean.pipe(field(4, "Whether the customer exists in live mode.")),
  email: Schema.NullOr(Schema.String).pipe(field(5, "Customer email address.")),
  name: Schema.NullOr(Schema.String).pipe(field(6, "Customer full name or business name.")),
  phone: Schema.NullOr(Schema.String).pipe(field(7, "Customer phone number.")),
  description: Schema.NullOr(Schema.String).pipe(field(8, "Free-text description.")),
  currency: Schema.NullOr(Schema.String).pipe(
    field(9, "Currency the customer is billed in for recurring billing."),
  ),
  balance: Long.pipe(
    field(10, "Balance in the smallest currency unit. Negative means credit, positive means owed."),
  ),
  delinquent: Schema.NullOr(Schema.Boolean).pipe(
    field(11, "Whether the latest invoice state change was a failed payment or missed due date."),
  ),
  tax_exempt: Schema.NullOr(Schema.String).pipe(
    field(12, "Tax exemption status: none, exempt, or reverse."),
  ),
  invoice_prefix: Schema.NullOr(Schema.String).pipe(field(13, "Prefix for invoice numbers.")),
  invoice_settings: Schema.Struct({
    default_payment_method: Schema.NullOr(Schema.String).pipe(
      field(106, "Default payment method for invoices and subscriptions."),
    ),
  }).pipe(field(14, "Default invoice settings.")),
  address: Schema.NullOr(address(100)).pipe(field(15, "Billing address.")),
  metadata: Metadata.pipe(field(16, "Key-value pairs set on the customer.")),
  _deleted: deleted(17),
  test_clock: Schema.NullOr(Schema.String).pipe(
    field(18, "Test clock the customer belongs to. Sandbox only."),
  ),
  shipping: Schema.NullOr(shipping(110)).pipe(field(19, "Shipping name, phone, and address.")),
}).annotate({
  description: "Customers in a Stripe account.",
});

export type Customer = Schema.Schema.Type<typeof CustomerSchema>;

export const CustomerObjectSchema = CustomerSchema.mapFields(Struct.omit(["version", "_deleted"]));

export type CustomerObject = Schema.Schema.Type<typeof CustomerObjectSchema>;
