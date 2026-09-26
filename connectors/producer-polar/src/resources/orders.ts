import { Option, Schema } from "effect";

import {
  CustomFieldDataJsonSchema,
  MetadataJsonSchema,
  OrderItemSchema,
  date,
  field,
  makeAddressSchema,
  nullableDate,
} from "./shared";

const OrderInputSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique order identifier.")),
  created_at: date(2, "Time when the order was created."),
  modified_at: nullableDate(3, "Time when the order was last changed."),
  status: Schema.Literals([
    "draft",
    "pending",
    "paid",
    "refunded",
    "partially_refunded",
    "void",
  ]).pipe(field(4, "Current order status.")),
  paid: Schema.Boolean.pipe(field(5, "Whether the order is paid.")),
  subtotal_amount: Schema.Int.pipe(field(6, "Subtotal in the smallest currency unit.")),
  discount_amount: Schema.Int.pipe(field(7, "Discount in the smallest currency unit.")),
  net_amount: Schema.Int.pipe(field(8, "Net amount in the smallest currency unit.")),
  tax_amount: Schema.Int.pipe(field(9, "Tax in the smallest currency unit.")),
  total_amount: Schema.Int.pipe(field(10, "Total in the smallest currency unit.")),
  applied_balance_amount: Schema.Int.pipe(field(11, "Customer balance applied to the order.")),
  due_amount: Schema.Int.pipe(field(12, "Amount still due.")),
  refunded_amount: Schema.Int.pipe(field(13, "Amount refunded.")),
  refunded_tax_amount: Schema.Int.pipe(field(14, "Tax amount refunded.")),
  refundable_amount: Schema.Int.pipe(field(15, "Amount that can still be refunded.")),
  refundable_tax_amount: Schema.Int.pipe(field(16, "Tax that can still be refunded.")),
  currency: Schema.String.pipe(field(17, "Three-letter currency code.")),
  billing_reason: Schema.Literals([
    "purchase",
    "subscription_create",
    "subscription_cycle",
    "subscription_update",
    "subscription_meter_cycle",
  ]).pipe(field(18, "Reason the order was created.")),
  billing_name: Schema.NullOr(Schema.String).pipe(
    field(19, "Name shown on the order billing details."),
  ),
  billing_address: Schema.NullOr(makeAddressSchema(100)).pipe(
    field(20, "Billing address for the order."),
  ),
  invoice_number: Schema.NullOr(Schema.String).pipe(field(21, "Invoice number for the order.")),
  receipt_number: Schema.NullOr(Schema.String).pipe(field(22, "Receipt number for the order.")),
  is_invoice_generated: Schema.Boolean.pipe(field(23, "Whether an invoice was generated.")),
  customer_id: Schema.String.pipe(field(24, "Customer linked to the order.")),
  product_id: Schema.NullOr(Schema.String).pipe(field(25, "Product linked to the order.")),
  discount_id: Schema.NullOr(Schema.String).pipe(field(26, "Discount applied to the order.")),
  subscription_id: Schema.NullOr(Schema.String).pipe(
    field(27, "Subscription linked to the order."),
  ),
  checkout_id: Schema.NullOr(Schema.String).pipe(field(28, "Checkout linked to the order.")),
  description: Schema.String.pipe(field(29, "Order description.")),
  seats: Schema.optional(Schema.NullOr(Schema.Int)).pipe(field(30, "Number of seats.")),
  units: Schema.NullOr(Schema.Int).pipe(field(31, "Number of units.")),
  next_payment_attempt_at: Schema.optional(Schema.NullOr(Schema.DateFromString)).pipe(
    field(32, "Time of the next payment attempt."),
  ),
  platform_fee_amount: Schema.Int.pipe(field(33, "Platform fee in the smallest currency unit.")),
  platform_fee_currency: Schema.NullOr(Schema.String).pipe(
    field(34, "Currency used for the platform fee."),
  ),
  metadata: MetadataJsonSchema.pipe(field(35, "Order metadata stored as JSON.")),
  items: Schema.Array(OrderItemSchema.annotate({ fieldId: 201 })).pipe(
    field(36, "Line items in the order."),
  ),
  custom_field_data: Schema.optional(CustomFieldDataJsonSchema).pipe(
    field(37, "Order custom fields stored as JSON."),
  ),
});

export const OrderSchema = OrderInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(38, "Time used to order order changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Orders in a Polar organization.",
});

export type Order = Schema.Schema.Type<typeof OrderSchema>;
