import { Schema } from "effect";

// Entity schemas
export const CustomerSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  email: Schema.String,
  name: Schema.NullOr(Schema.String),
});

export const CheckoutSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  status: Schema.String,
});

export const SubscriptionSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  started_at: Schema.NullOr(Schema.String),
  status: Schema.String,
});

export const OrderSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  modified_at: Schema.NullOr(Schema.String),
  status: Schema.String,
  paid: Schema.Boolean,
});

export const ListResponseSchema = Schema.Struct({
  items: Schema.Array(Schema.Unknown),
  pagination: Schema.Struct({
    total_count: Schema.Number,
    max_page: Schema.Number,
  }),
});

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
export type ListResponse = Schema.Schema.Type<typeof ListResponseSchema>;
export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
