import { Schema } from "effect";

// Entity schemas (snake_case, matching the Polar API wire format)

export const CustomerSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  deleted_at: Schema.NullOr(Schema.String),
  external_id: Schema.NullOr(Schema.String),
  email: Schema.String,
  email_verified: Schema.Boolean,
  name: Schema.NullOr(Schema.String),
  organization_id: Schema.String,
  avatar_url: Schema.String,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  billing_address: Schema.NullOr(Schema.Unknown),
  tax_id: Schema.NullOr(Schema.Unknown),
});

export const CheckoutSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  payment_processor: Schema.String,
  status: Schema.String,
  client_secret: Schema.String,
  url: Schema.String,
  expires_at: Schema.String,
  success_url: Schema.String,
  embed_origin: Schema.NullOr(Schema.String),
  amount: Schema.Number,
  discount_amount: Schema.Number,
  net_amount: Schema.Number,
  tax_amount: Schema.NullOr(Schema.Number),
  total_amount: Schema.Number,
  currency: Schema.String,
  product_id: Schema.String,
  product_price_id: Schema.String,
  discount_id: Schema.NullOr(Schema.String),
  allow_discount_codes: Schema.Boolean,
  require_billing_address: Schema.Boolean,
  is_discount_applicable: Schema.Boolean,
  is_free_product_price: Schema.Boolean,
  is_payment_required: Schema.Boolean,
  is_payment_setup_required: Schema.Boolean,
  is_payment_form_required: Schema.Boolean,
  customer_id: Schema.NullOr(Schema.String),
  is_business_customer: Schema.Boolean,
  customer_name: Schema.NullOr(Schema.String),
  customer_email: Schema.NullOr(Schema.String),
  customer_ip_address: Schema.NullOr(Schema.String),
  customer_billing_name: Schema.NullOr(Schema.String),
  customer_billing_address: Schema.NullOr(Schema.Unknown),
  customer_tax_id: Schema.NullOr(Schema.String),
  payment_processor_metadata: Schema.Record({
    key: Schema.String,
    value: Schema.String,
  }),
  external_customer_id: Schema.NullOr(Schema.String),
  customer_external_id: Schema.NullOr(Schema.String),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  product: Schema.Unknown,
  custom_field_data: Schema.optional(Schema.Unknown),
});

export const SubscriptionSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  amount: Schema.Number,
  currency: Schema.String,
  recurring_interval: Schema.String,
  status: Schema.String,
  current_period_start: Schema.String,
  current_period_end: Schema.NullOr(Schema.String),
  cancel_at_period_end: Schema.Boolean,
  canceled_at: Schema.NullOr(Schema.String),
  started_at: Schema.NullOr(Schema.String),
  ends_at: Schema.NullOr(Schema.String),
  ended_at: Schema.NullOr(Schema.String),
  customer_id: Schema.String,
  product_id: Schema.String,
  discount_id: Schema.NullOr(Schema.String),
  checkout_id: Schema.NullOr(Schema.String),
  customer_cancellation_reason: Schema.NullOr(Schema.String),
  customer_cancellation_comment: Schema.NullOr(Schema.String),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  customer: Schema.Unknown,
  product: Schema.Unknown,
  discount: Schema.NullOr(Schema.Unknown),
  custom_field_data: Schema.optional(Schema.Unknown),
});

export const OrderSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  status: Schema.String,
  paid: Schema.Boolean,
  subtotal_amount: Schema.Number,
  discount_amount: Schema.Number,
  net_amount: Schema.Number,
  tax_amount: Schema.Number,
  total_amount: Schema.Number,
  refunded_amount: Schema.Number,
  refunded_tax_amount: Schema.Number,
  currency: Schema.String,
  billing_reason: Schema.String,
  billing_name: Schema.NullOr(Schema.String),
  billing_address: Schema.NullOr(Schema.Unknown),
  is_invoice_generated: Schema.Boolean,
  customer_id: Schema.String,
  product_id: Schema.String,
  discount_id: Schema.NullOr(Schema.String),
  subscription_id: Schema.NullOr(Schema.String),
  checkout_id: Schema.NullOr(Schema.String),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  customer: Schema.Unknown,
  user_id: Schema.String,
  product: Schema.Unknown,
  discount: Schema.NullOr(Schema.Unknown),
  subscription: Schema.NullOr(Schema.Unknown),
  items: Schema.Array(Schema.Unknown),
  custom_field_data: Schema.optional(Schema.Unknown),
});

// Paginated list response

export const makeListResponseSchema = <A, I, R>(item: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    items: Schema.Array(item),
    pagination: Schema.Struct({
      total_count: Schema.Number,
      max_page: Schema.Number,
    }),
  });

export const ListResponseSchema = makeListResponseSchema(Schema.Unknown);

type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type ListResponse<T = unknown> = Prettify<
  Omit<Schema.Schema.Type<typeof ListResponseSchema>, "items"> & {
    readonly items: ReadonlyArray<T>;
  }
>;

// Webhook event schemas

const CheckoutEventSchema = Schema.Struct({
  type: Schema.Literal(
    "checkout.created",
    "checkout.updated",
    "checkout.expired",
  ),
  timestamp: Schema.String,
  data: CheckoutSchema,
});

const CustomerEventSchema = Schema.Struct({
  type: Schema.Literal(
    "customer.created",
    "customer.updated",
    "customer.deleted",
  ),
  timestamp: Schema.String,
  data: CustomerSchema,
});

const OrderEventSchema = Schema.Struct({
  type: Schema.Literal(
    "order.created",
    "order.updated",
    "order.paid",
    "order.refunded",
  ),
  timestamp: Schema.String,
  data: OrderSchema,
});

const SubscriptionEventSchema = Schema.Struct({
  type: Schema.Literal(
    "subscription.created",
    "subscription.updated",
    "subscription.active",
    "subscription.canceled",
    "subscription.uncanceled",
    "subscription.revoked",
    "subscription.past_due",
  ),
  timestamp: Schema.String,
  data: SubscriptionSchema,
});

export const WebhookPayloadSchema = Schema.Union(
  CheckoutEventSchema,
  CustomerEventSchema,
  OrderEventSchema,
  SubscriptionEventSchema,
);

// Derived types

export type Customer = Schema.Schema.Type<typeof CustomerSchema>;
export type Checkout = Schema.Schema.Type<typeof CheckoutSchema>;
export type Subscription = Schema.Schema.Type<typeof SubscriptionSchema>;
export type Order = Schema.Schema.Type<typeof OrderSchema>;
export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
