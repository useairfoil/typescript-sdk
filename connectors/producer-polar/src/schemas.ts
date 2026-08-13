import { Schema, SchemaTransformation } from "effect";

const MetadataSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
);

const CustomFieldDataSchema = Schema.Record(
  Schema.String,
  Schema.NullOr(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])),
);

export const AddressSchema = Schema.Struct({
  country: Schema.String,
  line1: Schema.optional(Schema.NullOr(Schema.String)),
  line2: Schema.optional(Schema.NullOr(Schema.String)),
  postal_code: Schema.optional(Schema.NullOr(Schema.String)),
  city: Schema.optional(Schema.NullOr(Schema.String)),
  state: Schema.optional(Schema.NullOr(Schema.String)),
});

export const OrderItemSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  label: Schema.String,
  amount: Schema.Int,
  tax_amount: Schema.Int,
  proration: Schema.Boolean,
  product_price_id: Schema.NullOr(Schema.String),
});

const CustomerInputSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  type: Schema.Literals(["individual", "team"]),
  deleted_at: Schema.NullOr(Schema.String),
  external_id: Schema.optional(Schema.NullOr(Schema.String)),
  email: Schema.optional(Schema.NullOr(Schema.String)),
  email_verified: Schema.Boolean,
  name: Schema.NullOr(Schema.String),
  billing_name: Schema.optional(Schema.NullOr(Schema.String)),
  billing_address: Schema.NullOr(AddressSchema),
  organization_id: Schema.String,
  avatar_url: Schema.NullOr(Schema.String),
  locale: Schema.optional(Schema.NullOr(Schema.String)),
  default_payment_method_id: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: MetadataSchema,
});

/** Safe customer row with the version used by Wings. */
export const CustomerSchema = CustomerInputSchema.pipe(
  Schema.decodeTo(
    Schema.Struct({ ...CustomerInputSchema.fields, version: Schema.String }),
    SchemaTransformation.transform({
      decode: (row) => ({ ...row, version: row.modified_at ?? row.created_at }),
      encode: ({ version: _version, ...row }) => row,
    }),
  ),
);

const CheckoutInputSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  payment_processor: Schema.Literal("stripe"),
  status: Schema.Literals(["open", "expired", "confirmed", "succeeded", "failed"]),
  expires_at: Schema.String,
  amount: Schema.Int,
  discount_amount: Schema.Int,
  net_amount: Schema.Int,
  tax_amount: Schema.NullOr(Schema.Int),
  tax_behavior: Schema.NullOr(Schema.Literals(["inclusive", "exclusive"])),
  total_amount: Schema.Int,
  currency: Schema.String,
  organization_id: Schema.String,
  product_id: Schema.NullOr(Schema.String),
  product_price_id: Schema.NullOr(Schema.String),
  discount_id: Schema.NullOr(Schema.String),
  subscription_id: Schema.NullOr(Schema.String),
  customer_id: Schema.NullOr(Schema.String),
  external_customer_id: Schema.NullOr(Schema.String),
  allow_discount_codes: Schema.Boolean,
  require_billing_address: Schema.Boolean,
  is_discount_applicable: Schema.Boolean,
  is_free_product_price: Schema.Boolean,
  is_payment_required: Schema.Boolean,
  is_payment_setup_required: Schema.Boolean,
  is_payment_form_required: Schema.Boolean,
  is_business_customer: Schema.Boolean,
  customer_name: Schema.NullOr(Schema.String),
  customer_email: Schema.NullOr(Schema.String),
  customer_billing_name: Schema.NullOr(Schema.String),
  customer_billing_address: Schema.NullOr(AddressSchema),
  allow_trial: Schema.NullOr(Schema.Boolean),
  active_trial_interval: Schema.NullOr(Schema.Literals(["day", "week", "month", "year"])),
  active_trial_interval_count: Schema.NullOr(Schema.Int),
  trial_end: Schema.NullOr(Schema.String),
  trial_interval: Schema.NullOr(Schema.Literals(["day", "week", "month", "year"])),
  trial_interval_count: Schema.NullOr(Schema.Int),
  seats: Schema.optional(Schema.NullOr(Schema.Int)),
  min_seats: Schema.optional(Schema.NullOr(Schema.Int)),
  max_seats: Schema.optional(Schema.NullOr(Schema.Int)),
  metadata: MetadataSchema,
  custom_field_data: Schema.optional(CustomFieldDataSchema),
});

/** Safe checkout row with credential-bearing provider fields omitted. */
export const CheckoutSchema = CheckoutInputSchema.pipe(
  Schema.decodeTo(
    Schema.Struct({ ...CheckoutInputSchema.fields, version: Schema.String }),
    SchemaTransformation.transform({
      decode: (row) => ({ ...row, version: row.modified_at ?? row.created_at }),
      encode: ({ version: _version, ...row }) => row,
    }),
  ),
);

const SubscriptionInputSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  amount: Schema.Int,
  currency: Schema.String,
  recurring_interval: Schema.Literals(["day", "week", "month", "year"]),
  recurring_interval_count: Schema.Int,
  status: Schema.Literals([
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ]),
  current_period_start: Schema.String,
  current_period_end: Schema.String,
  current_meter_period_start: Schema.NullOr(Schema.String),
  current_meter_period_end: Schema.NullOr(Schema.String),
  trial_start: Schema.NullOr(Schema.String),
  trial_end: Schema.NullOr(Schema.String),
  cancel_at_period_end: Schema.Boolean,
  canceled_at: Schema.NullOr(Schema.String),
  started_at: Schema.NullOr(Schema.String),
  ends_at: Schema.NullOr(Schema.String),
  ended_at: Schema.NullOr(Schema.String),
  pause_at_period_end: Schema.Boolean,
  paused_at: Schema.NullOr(Schema.String),
  resumes_at: Schema.NullOr(Schema.String),
  past_due_at: Schema.optional(Schema.NullOr(Schema.String)),
  customer_id: Schema.String,
  product_id: Schema.String,
  discount_id: Schema.NullOr(Schema.String),
  checkout_id: Schema.NullOr(Schema.String),
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
  ),
  customer_cancellation_comment: Schema.NullOr(Schema.String),
  seats: Schema.optional(Schema.NullOr(Schema.Int)),
  metadata: MetadataSchema,
  custom_field_data: Schema.optional(CustomFieldDataSchema),
});

/** Safe subscription row with the version used by Wings. */
export const SubscriptionSchema = SubscriptionInputSchema.pipe(
  Schema.decodeTo(
    Schema.Struct({ ...SubscriptionInputSchema.fields, version: Schema.String }),
    SchemaTransformation.transform({
      decode: (row) => ({ ...row, version: row.modified_at ?? row.created_at }),
      encode: ({ version: _version, ...row }) => row,
    }),
  ),
);

const OrderInputSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  status: Schema.Literals(["draft", "pending", "paid", "refunded", "partially_refunded", "void"]),
  paid: Schema.Boolean,
  subtotal_amount: Schema.Int,
  discount_amount: Schema.Int,
  net_amount: Schema.Int,
  tax_amount: Schema.Int,
  total_amount: Schema.Int,
  applied_balance_amount: Schema.Int,
  due_amount: Schema.Int,
  refunded_amount: Schema.Int,
  refunded_tax_amount: Schema.Int,
  refundable_amount: Schema.Int,
  refundable_tax_amount: Schema.Int,
  currency: Schema.String,
  billing_reason: Schema.Literals([
    "purchase",
    "subscription_create",
    "subscription_cycle",
    "subscription_update",
  ]),
  billing_name: Schema.NullOr(Schema.String),
  billing_address: Schema.NullOr(AddressSchema),
  invoice_number: Schema.NullOr(Schema.String),
  receipt_number: Schema.NullOr(Schema.String),
  is_invoice_generated: Schema.Boolean,
  customer_id: Schema.String,
  product_id: Schema.NullOr(Schema.String),
  discount_id: Schema.NullOr(Schema.String),
  subscription_id: Schema.NullOr(Schema.String),
  checkout_id: Schema.NullOr(Schema.String),
  description: Schema.String,
  seats: Schema.optional(Schema.NullOr(Schema.Int)),
  next_payment_attempt_at: Schema.optional(Schema.NullOr(Schema.String)),
  platform_fee_amount: Schema.Int,
  platform_fee_currency: Schema.NullOr(Schema.String),
  metadata: MetadataSchema,
  items: Schema.Array(OrderItemSchema),
  custom_field_data: Schema.optional(CustomFieldDataSchema),
});

/** Safe order row with nested provider snapshots removed. */
export const OrderSchema = OrderInputSchema.pipe(
  Schema.decodeTo(
    Schema.Struct({ ...OrderInputSchema.fields, version: Schema.String }),
    SchemaTransformation.transform({
      decode: (row) => ({ ...row, version: row.modified_at ?? row.created_at }),
      encode: ({ version: _version, ...row }) => row,
    }),
  ),
);

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

export const CheckoutEventSchema = Schema.Struct({
  type: Schema.Literals(["checkout.created", "checkout.updated", "checkout.expired"]),
  timestamp: Schema.String,
  data: CheckoutSchema,
});

export const CustomerEventSchema = Schema.Struct({
  type: Schema.Literals(["customer.created", "customer.updated", "customer.deleted"]),
  timestamp: Schema.String,
  data: CustomerSchema,
});

export const OrderEventSchema = Schema.Struct({
  type: Schema.Literals(["order.created", "order.updated", "order.paid", "order.refunded"]),
  timestamp: Schema.String,
  data: OrderSchema,
});

export const SubscriptionEventSchema = Schema.Struct({
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
  timestamp: Schema.String,
  data: SubscriptionSchema,
});

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
  CheckoutEventSchema,
  CustomerEventSchema,
  OrderEventSchema,
  SubscriptionEventSchema,
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
