import * as Schema from "effect/Schema";

import type { Cart, CartLineItem } from "./row";

import { RestMoneyBagSchema, fromRest, gid, normalizeAmount } from "../shared";

const JsonStringSchema = Schema.flip(Schema.fromJsonString(Schema.Unknown));

const CartWebhookLineItemSchema = Schema.Struct({
  id: Schema.Union([Schema.String, Schema.Number]),
  properties: Schema.Union([Schema.Null, JsonStringSchema]),
  quantity: Schema.Int,
  variant_id: Schema.Union([Schema.String, Schema.Number]),
  key: Schema.String,
  discounted_price: Schema.String,
  discounts: JsonStringSchema,
  gift_card: Schema.Boolean,
  grams: Schema.Int,
  line_price: Schema.String,
  original_line_price: Schema.String,
  original_price: Schema.String,
  price: Schema.String,
  product_id: Schema.Union([Schema.String, Schema.Number]),
  sku: Schema.NullOr(Schema.String),
  taxable: Schema.Boolean,
  title: Schema.String,
  total_discount: Schema.String,
  vendor: Schema.String,
  discounted_price_set: RestMoneyBagSchema,
  line_price_set: RestMoneyBagSchema,
  original_line_price_set: RestMoneyBagSchema,
  price_set: RestMoneyBagSchema,
  total_discount_set: RestMoneyBagSchema,
  parent_relationship: Schema.Union([Schema.Null, JsonStringSchema]),
});

export const CartWebhookPayloadSchema = Schema.Struct({
  id: Schema.String,
  token: Schema.String,
  line_items: Schema.Array(CartWebhookLineItemSchema),
  note: Schema.NullOr(Schema.String),
  updated_at: Schema.DateFromString,
  created_at: Schema.DateFromString,
});

export const CartWebhookEventSchema = Schema.Struct({
  id: Schema.String,
  token: Schema.String,
  line_items: Schema.Array(Schema.toType(CartWebhookLineItemSchema)),
  note: Schema.NullOr(Schema.String),
  updated_at: Schema.Date,
  created_at: Schema.Date,
  topic: Schema.Literals(["carts/create", "carts/update"]),
});

export type CartWebhookLineItem = Schema.Schema.Type<typeof CartWebhookLineItemSchema>;

export type CartWebhookPayload = Schema.Schema.Type<typeof CartWebhookPayloadSchema>;

const normalizeCartLineItem = (item: CartWebhookLineItem): CartLineItem => ({
  id: String(item.id),
  properties: item.properties,
  quantity: item.quantity,
  variantId: gid("ProductVariant", item.variant_id),
  key: item.key,
  discountedPrice: normalizeAmount(item.discounted_price),
  discounts: item.discounts,
  giftCard: item.gift_card,
  grams: item.grams,
  linePrice: normalizeAmount(item.line_price),
  originalLinePrice: normalizeAmount(item.original_line_price),
  originalPrice: normalizeAmount(item.original_price),
  price: normalizeAmount(item.price),
  productId: gid("Product", item.product_id),
  sku: item.sku,
  taxable: item.taxable,
  title: item.title,
  totalDiscount: normalizeAmount(item.total_discount),
  vendor: item.vendor,
  discountedPriceSet: fromRest.money(item.discounted_price_set),
  linePriceSet: fromRest.money(item.line_price_set),
  originalLinePriceSet: fromRest.money(item.original_line_price_set),
  priceSet: fromRest.money(item.price_set),
  totalDiscountSet: fromRest.money(item.total_discount_set),
  parentRelationship: item.parent_relationship,
});

export const fromCartWebhook = (
  payload: CartWebhookPayload,
  topic: "carts/create" | "carts/update",
): Cart => ({
  id: payload.id,
  token: payload.token,
  topic,
  lineItems: payload.line_items.map(normalizeCartLineItem),
  note: payload.note ?? "",
  updatedAt: payload.updated_at,
  createdAt: payload.created_at,
});
