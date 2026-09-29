import { Option, Schema } from "effect";

import { MetadataJsonSchema, date, field, makeAddressSchema, nullableDate } from "./shared";

const CustomerInputSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique customer identifier.")),
  created_at: date(2, "Time when the customer was created."),
  modified_at: nullableDate(3, "Time when the customer was last changed."),
  type: Schema.Literals(["individual", "team"]).pipe(field(4, "Customer account type.")),
  deleted_at: nullableDate(5, "Time when the customer was deleted."),
  external_id: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(6, "Customer identifier from another system."),
  ),
  email: Schema.optional(Schema.NullOr(Schema.String)).pipe(field(7, "Customer email address.")),
  email_verified: Schema.Boolean.pipe(field(8, "Whether the email address is verified.")),
  name: Schema.NullOr(Schema.String).pipe(field(9, "Customer name.")),
  billing_name: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(10, "Name shown on billing details."),
  ),
  billing_address: Schema.NullOr(makeAddressSchema(100)).pipe(
    field(11, "Customer billing address."),
  ),
  organization_id: Schema.String.pipe(field(12, "Organization that owns the customer.")),
  avatar_url: Schema.NullOr(Schema.String).pipe(field(13, "URL of the customer avatar.")),
  locale: Schema.optional(Schema.NullOr(Schema.String)).pipe(field(14, "Customer locale.")),
  default_payment_method_id: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(15, "Default payment method for the customer."),
  ),
  metadata: MetadataJsonSchema.pipe(field(16, "Customer metadata stored as JSON.")),
  _af_deleted: Schema.optional(Schema.Boolean).pipe(field(18, "Whether the customer was deleted.")),
});

export const CustomerSchema = CustomerInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(17, "Time used to order customer changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Customers in a Polar organization.",
});

export type Customer = Schema.Schema.Type<typeof CustomerSchema>;
