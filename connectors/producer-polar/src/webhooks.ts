import { Schema } from "effect";

import { CheckoutSchema } from "./resources/checkouts";
import { CustomerSchema } from "./resources/customers";
import { DiscountSchema } from "./resources/discounts";
import { OrderSchema } from "./resources/orders";
import { ProductSchema } from "./resources/products";
import { RefundSchema } from "./resources/refunds";
import { SubscriptionSchema } from "./resources/subscriptions";

export const checkoutEventTypes = [
  "checkout.created",
  "checkout.updated",
  "checkout.expired",
] as const;

export const customerEventTypes = [
  "customer.created",
  "customer.updated",
  "customer.deleted",
] as const;

export const orderEventTypes = [
  "order.created",
  "order.updated",
  "order.paid",
  "order.refunded",
] as const;

export const subscriptionEventTypes = [
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

export const refundEventTypes = ["refund.created", "refund.updated"] as const;

export const productEventTypes = ["product.created", "product.updated"] as const;

export const discountEventTypes = [
  "discount.created",
  "discount.updated",
  "discount.deleted",
] as const;

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

// Known events must fully decode. Other events get a 200 and are skipped.
export const WebhookPayloadSchema = Schema.Union([
  CheckoutEventInputSchema,
  CustomerEventInputSchema,
  OrderEventInputSchema,
  SubscriptionEventInputSchema,
  RefundEventInputSchema,
  ProductEventInputSchema,
  DiscountEventInputSchema,
  Schema.Struct({
    type: Schema.String.check(
      Schema.makeFilter((type) => !handledEventTypes.has(type) || "handled event type"),
    ),
  }),
]);

export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
