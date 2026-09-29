import { Schema, SchemaTransformation } from "effect";

import { CheckoutSchema } from "./resources/checkouts";
import { CustomerSchema } from "./resources/customers";
import { DiscountSchema } from "./resources/discounts";
import { OrderSchema } from "./resources/orders";
import { ProductSchema } from "./resources/products";
import { RefundSchema } from "./resources/refunds";
import { SubscriptionSchema } from "./resources/subscriptions";

const checkoutEventTypes = ["checkout.created", "checkout.updated", "checkout.expired"] as const;

const customerEventTypes = ["customer.created", "customer.updated", "customer.deleted"] as const;

const orderEventTypes = ["order.created", "order.updated", "order.paid", "order.refunded"] as const;

const subscriptionEventTypes = [
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.revoked",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.cycled",
  "subscription.migrated",
] as const;

const refundEventTypes = ["refund.created", "refund.updated"] as const;

const productEventTypes = ["product.created", "product.updated"] as const;

const discountEventTypes = ["discount.created", "discount.updated", "discount.deleted"] as const;

const handledEventTypes: ReadonlySet<string> = new Set([
  ...checkoutEventTypes,
  ...customerEventTypes,
  ...orderEventTypes,
  ...subscriptionEventTypes,
  ...refundEventTypes,
  ...productEventTypes,
  ...discountEventTypes,
]);

const makeEventInputSchema = <const Types extends ReadonlyArray<string>, Data extends Schema.Top>(
  types: Types,
  data: Data,
) =>
  Schema.Struct({
    type: Schema.Literals(types),
    timestamp: Schema.DateFromString,
    api_version: Schema.String,
    data,
  });

const CheckoutEventInputSchema = makeEventInputSchema(checkoutEventTypes, CheckoutSchema);

const CustomerEventInputSchema = makeEventInputSchema(customerEventTypes, CustomerSchema);

const OrderEventInputSchema = makeEventInputSchema(orderEventTypes, OrderSchema);

const SubscriptionEventInputSchema = makeEventInputSchema(
  subscriptionEventTypes,
  SubscriptionSchema,
);

const RefundEventInputSchema = makeEventInputSchema(refundEventTypes, RefundSchema);

const ProductEventInputSchema = makeEventInputSchema(productEventTypes, ProductSchema);

const DiscountEventInputSchema = makeEventInputSchema(discountEventTypes, DiscountSchema);

export const CheckoutEventSchema = Schema.toType(CheckoutEventInputSchema);

export const CustomerEventSchema = Schema.toType(CustomerEventInputSchema);

export const OrderEventSchema = Schema.toType(OrderEventInputSchema);

export const SubscriptionEventSchema = Schema.toType(SubscriptionEventInputSchema);

export const RefundEventSchema = Schema.toType(RefundEventInputSchema);

export const ProductEventSchema = Schema.toType(ProductEventInputSchema);

export const DiscountEventSchema = Schema.toType(DiscountEventInputSchema);

// Unknown events are ignored, but invalid known events still fail.
const IgnoredEventSchema = Schema.Struct({
  type: Schema.String.check(
    Schema.makeFilter((type) => !handledEventTypes.has(type) || "handled event type"),
  ),
  timestamp: Schema.String,
  api_version: Schema.String,
}).pipe(
  Schema.decodeTo(
    Schema.Struct({
      type: Schema.Literal("ignored"),
      event_type: Schema.String,
      api_version: Schema.String,
    }),
    SchemaTransformation.transform({
      decode: (event) => ({
        type: "ignored" as const,
        event_type: event.type,
        api_version: event.api_version,
      }),
      encode: (event) => ({
        type: event.event_type,
        timestamp: "",
        api_version: event.api_version,
      }),
    }),
  ),
);

export const WebhookPayloadSchema = Schema.Union([
  CheckoutEventInputSchema,
  CustomerEventInputSchema,
  OrderEventInputSchema,
  SubscriptionEventInputSchema,
  RefundEventInputSchema,
  ProductEventInputSchema,
  DiscountEventInputSchema,
  IgnoredEventSchema,
]);

export type CustomerEvent = Schema.Schema.Type<typeof CustomerEventSchema>;

export type CheckoutEvent = Schema.Schema.Type<typeof CheckoutEventSchema>;

export type OrderEvent = Schema.Schema.Type<typeof OrderEventSchema>;

export type SubscriptionEvent = Schema.Schema.Type<typeof SubscriptionEventSchema>;

export type RefundEvent = Schema.Schema.Type<typeof RefundEventSchema>;

export type ProductEvent = Schema.Schema.Type<typeof ProductEventSchema>;

export type DiscountEvent = Schema.Schema.Type<typeof DiscountEventSchema>;

export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
