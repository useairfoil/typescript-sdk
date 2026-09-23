import { Iceberg } from "@useairfoil/connector-kit";
import { Option, Schema } from "effect";

const field = (fieldId: number, description: string) => Iceberg.field(fieldId, { description });

const MetadataSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
);

const CustomFieldDataSchema = Schema.Record(
  Schema.String,
  Schema.NullOr(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])),
);

const MetadataJsonSchema = Schema.flip(Schema.fromJsonString(MetadataSchema));
const CustomFieldDataJsonSchema = Schema.flip(Schema.fromJsonString(CustomFieldDataSchema));

const date = (fieldId: number, description: string) =>
  Schema.DateFromString.pipe(field(fieldId, description));

const nullableDate = (fieldId: number, description: string) =>
  Schema.NullOr(Schema.DateFromString).pipe(field(fieldId, description));

const makeAddressSchema = (baseId: number) => {
  const id = Iceberg.ids(baseId);

  return Schema.Struct({
    country: Schema.String.pipe(field(id(1), "Country code for the address.")),
    line1: Schema.optional(Schema.NullOr(Schema.String)).pipe(
      field(id(2), "First line of the address."),
    ),
    line2: Schema.optional(Schema.NullOr(Schema.String)).pipe(
      field(id(3), "Second line of the address."),
    ),
    postal_code: Schema.optional(Schema.NullOr(Schema.String)).pipe(
      field(id(4), "Postal code for the address."),
    ),
    city: Schema.optional(Schema.NullOr(Schema.String)).pipe(field(id(5), "City for the address.")),
    state: Schema.optional(Schema.NullOr(Schema.String)).pipe(
      field(id(6), "State or region for the address."),
    ),
  });
};

export const AddressSchema = makeAddressSchema(100);

export const OrderItemSchema = Schema.Struct({
  id: Schema.String.pipe(field(202, "Unique order item identifier.")),
  created_at: date(203, "Time when the order item was created."),
  modified_at: nullableDate(204, "Time when the order item was last changed."),
  label: Schema.String.pipe(field(205, "Display label for the order item.")),
  amount: Schema.Int.pipe(field(206, "Order item amount in the smallest currency unit.")),
  tax_amount: Schema.Int.pipe(field(207, "Tax amount in the smallest currency unit.")),
  proration: Schema.Boolean.pipe(field(208, "Whether the item is a proration.")),
  product_price_id: Schema.NullOr(Schema.String).pipe(
    field(209, "Product price linked to the item."),
  ),
});

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
  metadata: MetadataJsonSchema.pipe(field(42, "Checkout metadata stored as JSON.")),
  custom_field_data: Schema.optional(CustomFieldDataJsonSchema).pipe(
    field(43, "Checkout custom fields stored as JSON."),
  ),
});

export const CheckoutSchema = CheckoutInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(44, "Time used to order checkout changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Checkout sessions in a Polar organization.",
});

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
  metadata: MetadataJsonSchema.pipe(field(31, "Subscription metadata stored as JSON.")),
  custom_field_data: Schema.optional(CustomFieldDataJsonSchema).pipe(
    field(32, "Subscription custom fields stored as JSON."),
  ),
});

export const SubscriptionSchema = SubscriptionInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(33, "Time used to order subscription changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Subscriptions in a Polar organization.",
});

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
  next_payment_attempt_at: Schema.optional(Schema.NullOr(Schema.DateFromString)).pipe(
    field(31, "Time of the next payment attempt."),
  ),
  platform_fee_amount: Schema.Int.pipe(field(32, "Platform fee in the smallest currency unit.")),
  platform_fee_currency: Schema.NullOr(Schema.String).pipe(
    field(33, "Currency used for the platform fee."),
  ),
  metadata: MetadataJsonSchema.pipe(field(34, "Order metadata stored as JSON.")),
  items: Schema.Array(OrderItemSchema.annotate({ fieldId: 201 })).pipe(
    field(35, "Line items in the order."),
  ),
  custom_field_data: Schema.optional(CustomFieldDataJsonSchema).pipe(
    field(36, "Order custom fields stored as JSON."),
  ),
});

export const OrderSchema = OrderInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(37, "Time used to order order changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Orders in a Polar organization.",
});

export const makeListResponseSchema = <A>(
  item: Schema.Decoder<A>,
): Schema.Decoder<ListResponse<A>> =>
  Schema.Struct({
    items: Schema.Array(item),
    pagination: Schema.Struct({
      total_count: Schema.Int,
      max_page: Schema.Int,
    }),
  });

export const ListResponseSchema = makeListResponseSchema(Schema.Any);

const CheckoutEventInputSchema = Schema.Struct({
  type: Schema.Literals(["checkout.created", "checkout.updated", "checkout.expired"]),
  timestamp: Schema.DateFromString,
  data: CheckoutSchema,
});

const CustomerEventInputSchema = Schema.Struct({
  type: Schema.Literals(["customer.created", "customer.updated", "customer.deleted"]),
  timestamp: Schema.DateFromString,
  data: CustomerSchema,
});

const OrderEventInputSchema = Schema.Struct({
  type: Schema.Literals(["order.created", "order.updated", "order.paid", "order.refunded"]),
  timestamp: Schema.DateFromString,
  data: OrderSchema,
});

const SubscriptionEventInputSchema = Schema.Struct({
  type: Schema.Literals([
    "subscription.created",
    "subscription.updated",
    "subscription.active",
    "subscription.canceled",
    "subscription.uncanceled",
    "subscription.revoked",
    "subscription.past_due",
    "subscription.paused",
    "subscription.resumed",
  ]),
  timestamp: Schema.DateFromString,
  data: SubscriptionSchema,
});

export const CheckoutEventSchema = Schema.toType(CheckoutEventInputSchema);
export const CustomerEventSchema = Schema.toType(CustomerEventInputSchema);
export const OrderEventSchema = Schema.toType(OrderEventInputSchema);
export const SubscriptionEventSchema = Schema.toType(SubscriptionEventInputSchema);

const IgnoredEventSchema = Schema.Struct({
  type: Schema.Literals([
    "customer.state_changed",
    "customer_seat.assigned",
    "customer_seat.claimed",
    "customer_seat.revoked",
    "member.created",
    "member.updated",
    "member.deleted",
    "refund.created",
    "refund.updated",
    "product.created",
    "product.updated",
    "benefit.created",
    "benefit.updated",
    "benefit_grant.created",
    "benefit_grant.cycled",
    "benefit_grant.updated",
    "benefit_grant.revoked",
    "organization.updated",
  ]),
  timestamp: Schema.String,
  data: Schema.Any,
});

export const WebhookPayloadSchema = Schema.Union([
  CheckoutEventInputSchema,
  CustomerEventInputSchema,
  OrderEventInputSchema,
  SubscriptionEventInputSchema,
  IgnoredEventSchema,
]);

export type Address = Schema.Schema.Type<typeof AddressSchema>;
export type OrderItem = Schema.Schema.Type<typeof OrderItemSchema>;
export type Customer = Schema.Schema.Type<typeof CustomerSchema>;
export type Checkout = Schema.Schema.Type<typeof CheckoutSchema>;
export type Subscription = Schema.Schema.Type<typeof SubscriptionSchema>;
export type Order = Schema.Schema.Type<typeof OrderSchema>;
export type ListResponse<T = unknown> = {
  readonly items: ReadonlyArray<T>;
  readonly pagination: {
    readonly total_count: number;
    readonly max_page: number;
  };
};
export type CustomerEvent = Schema.Schema.Type<typeof CustomerEventSchema>;
export type CheckoutEvent = Schema.Schema.Type<typeof CheckoutEventSchema>;
export type OrderEvent = Schema.Schema.Type<typeof OrderEventSchema>;
export type SubscriptionEvent = Schema.Schema.Type<typeof SubscriptionEventSchema>;
export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
