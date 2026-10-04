import type { Schema } from "effect";

import { ChargeSchema } from "./schemas/charges";
import { CustomerSchema } from "./schemas/customers";
import { InvoiceSchema } from "./schemas/invoices";
import { PriceSchema } from "./schemas/prices";
import { ProductSchema } from "./schemas/products";
import { RefundSchema } from "./schemas/refunds";
import { SubscriptionSchema } from "./schemas/subscriptions";

export const tableSchemas: Readonly<Record<string, Schema.Top>> = {
  customers: CustomerSchema,
  products: ProductSchema,
  prices: PriceSchema,
  subscriptions: SubscriptionSchema,
  invoices: InvoiceSchema,
  charges: ChargeSchema,
  refunds: RefundSchema,
};
