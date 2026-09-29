import { Schema } from "effect";

import { CheckoutSchema } from "./resources/checkouts";
import { CustomerSchema } from "./resources/customers";
import { DiscountSchema } from "./resources/discounts";
import { OrderSchema } from "./resources/orders";
import { ProductSchema } from "./resources/products";
import { RefundSchema } from "./resources/refunds";
import { SubscriptionSchema } from "./resources/subscriptions";

export const tableSchemas: Readonly<Record<string, Schema.Top>> = {
  customers: CustomerSchema,
  checkouts: CheckoutSchema,
  orders: OrderSchema,
  subscriptions: SubscriptionSchema,
  refunds: RefundSchema,
  products: ProductSchema,
  discounts: DiscountSchema,
};
