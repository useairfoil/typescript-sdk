import { Option, Schema } from "effect";

import {
  CustomFieldDataJsonSchema,
  MetadataJsonSchema,
  date,
  field,
  makeAddressSchema,
  nullableDate,
} from "./shared";

const CheckoutInputSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique checkout identifier.")),
  created_at: date(2, "Time when the checkout was created."),
  modified_at: nullableDate(3, "Time when the checkout was last changed."),
  payment_processor: Schema.Literal("stripe").pipe(field(4, "Payment processor for the checkout.")),
  status: Schema.Literals(["open", "expired", "confirmed", "succeeded", "failed"]).pipe(
    field(5, "Current checkout status."),
  ),
  expires_at: date(6, "Time when the checkout expires."),
  amount: Schema.Int.pipe(field(7, "Checkout amount in the smallest currency unit.")),
  discount_amount: Schema.Int.pipe(field(8, "Discount in the smallest currency unit.")),
  net_amount: Schema.Int.pipe(field(9, "Net amount in the smallest currency unit.")),
  tax_amount: Schema.NullOr(Schema.Int).pipe(field(10, "Tax in the smallest currency unit.")),
  tax_behavior: Schema.NullOr(Schema.Literals(["inclusive", "exclusive"])).pipe(
    field(11, "How tax is applied."),
  ),
  total_amount: Schema.Int.pipe(field(12, "Total in the smallest currency unit.")),
  currency: Schema.String.pipe(field(13, "Three-letter currency code.")),
  organization_id: Schema.String.pipe(field(14, "Organization that owns the checkout.")),
  product_id: Schema.NullOr(Schema.String).pipe(field(15, "Product being purchased.")),
  product_price_id: Schema.NullOr(Schema.String).pipe(field(16, "Product price being purchased.")),
  discount_id: Schema.NullOr(Schema.String).pipe(field(17, "Discount used by the checkout.")),
  subscription_id: Schema.NullOr(Schema.String).pipe(
    field(18, "Subscription created by the checkout."),
  ),
  customer_id: Schema.NullOr(Schema.String).pipe(field(19, "Customer linked to the checkout.")),
  external_customer_id: Schema.NullOr(Schema.String).pipe(
    field(20, "Customer identifier from another system."),
  ),
  allow_discount_codes: Schema.Boolean.pipe(field(21, "Whether discount codes can be entered.")),
  require_billing_address: Schema.Boolean.pipe(field(22, "Whether a billing address is required.")),
  is_discount_applicable: Schema.Boolean.pipe(field(23, "Whether a discount can be applied.")),
  is_free_product_price: Schema.Boolean.pipe(field(24, "Whether the product price is free.")),
  is_payment_required: Schema.Boolean.pipe(field(25, "Whether payment is required.")),
  is_payment_setup_required: Schema.Boolean.pipe(field(26, "Whether payment setup is required.")),
  is_payment_form_required: Schema.Boolean.pipe(field(27, "Whether the payment form is required.")),
  is_business_customer: Schema.Boolean.pipe(field(28, "Whether the customer is a business.")),
  customer_name: Schema.NullOr(Schema.String).pipe(
    field(29, "Customer name captured at checkout."),
  ),
  customer_email: Schema.NullOr(Schema.String).pipe(
    field(30, "Customer email captured at checkout."),
  ),
  customer_billing_name: Schema.NullOr(Schema.String).pipe(
    field(31, "Billing name captured at checkout."),
  ),
  customer_billing_address: Schema.NullOr(makeAddressSchema(100)).pipe(
    field(32, "Billing address captured at checkout."),
  ),
  allow_trial: Schema.NullOr(Schema.Boolean).pipe(field(33, "Whether a trial can be used.")),
  active_trial_interval: Schema.NullOr(Schema.Literals(["day", "week", "month", "year"])).pipe(
    field(34, "Unit for the active trial."),
  ),
  active_trial_interval_count: Schema.NullOr(Schema.Int).pipe(
    field(35, "Number of active trial intervals."),
  ),
  trial_end: nullableDate(36, "Time when the trial ends."),
  trial_interval: Schema.NullOr(Schema.Literals(["day", "week", "month", "year"])).pipe(
    field(37, "Unit for the trial."),
  ),
  trial_interval_count: Schema.NullOr(Schema.Int).pipe(field(38, "Number of trial intervals.")),
  seats: Schema.optional(Schema.NullOr(Schema.Int)).pipe(field(39, "Number of seats.")),
  min_seats: Schema.optional(Schema.NullOr(Schema.Int)).pipe(field(40, "Minimum number of seats.")),
  max_seats: Schema.optional(Schema.NullOr(Schema.Int)).pipe(field(41, "Maximum number of seats.")),
  units: Schema.NullOr(Schema.Int).pipe(field(42, "Number of units.")),
  min_units: Schema.NullOr(Schema.Int).pipe(field(43, "Minimum number of units.")),
  max_units: Schema.NullOr(Schema.Int).pipe(field(44, "Maximum number of units.")),
  metadata: MetadataJsonSchema.pipe(field(45, "Checkout metadata stored as JSON.")),
  custom_field_data: Schema.optional(CustomFieldDataJsonSchema).pipe(
    field(46, "Checkout custom fields stored as JSON."),
  ),
});

export const CheckoutSchema = CheckoutInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(47, "Time used to order checkout changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Checkout sessions in a Polar organization.",
});

export type Checkout = Schema.Schema.Type<typeof CheckoutSchema>;
