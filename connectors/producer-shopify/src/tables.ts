import * as Schema from "effect/Schema";

import { CartSchema } from "./resources/carts/row";
import { CustomerSchema } from "./resources/customers/row";
import { OrderSchema } from "./resources/orders/row";
import { ProductSchema } from "./resources/products/row";
import { RefundSchema } from "./resources/refunds/row";

export const tableSchemas: Readonly<Record<string, Schema.Top>> = {
  products: ProductSchema,
  carts: CartSchema,
  customers: CustomerSchema,
  orders: OrderSchema,
  refunds: RefundSchema,
};
