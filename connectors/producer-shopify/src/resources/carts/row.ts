import * as Schema from "effect/Schema";

import { field, moneyBag } from "../shared";

export const CartLineItemSchema = Schema.Struct({
  id: Schema.String.pipe(field(102, "Unique cart line identifier.")),
  properties: Schema.NullOr(Schema.String).pipe(
    field(103, "Custom line properties stored as JSON."),
  ),
  quantity: Schema.Int.pipe(field(104, "Quantity of the cart line.")),
  variantId: Schema.String.pipe(field(105, "Product variant identifier.")),
  key: Schema.String.pipe(field(106, "Unique key for the cart line.")),
  discountedPrice: Schema.String.pipe(field(107, "Price after discounts.")),
  discounts: Schema.String.pipe(field(108, "Line discounts stored as JSON.")),
  giftCard: Schema.Boolean.pipe(field(109, "Whether the line is a gift card.")),
  grams: Schema.Int.pipe(field(110, "Weight of the line in grams.")),
  linePrice: Schema.String.pipe(field(111, "Total price for the line.")),
  originalLinePrice: Schema.String.pipe(field(112, "Line price before discounts.")),
  originalPrice: Schema.String.pipe(field(113, "Unit price before discounts.")),
  price: Schema.String.pipe(field(114, "Current unit price.")),
  productId: Schema.String.pipe(field(115, "Product identifier.")),
  sku: Schema.NullOr(Schema.String).pipe(field(116, "Stock keeping unit for the line.")),
  taxable: Schema.Boolean.pipe(field(117, "Whether the line is taxable.")),
  title: Schema.String.pipe(field(118, "Title of the cart line.")),
  totalDiscount: Schema.String.pipe(field(119, "Total discount for the line.")),
  vendor: Schema.String.pipe(field(120, "Vendor of the product.")),
  discountedPriceSet: moneyBag(200).pipe(field(121, "Price after discounts.")),
  linePriceSet: moneyBag(210).pipe(field(122, "Total price for the line.")),
  originalLinePriceSet: moneyBag(220).pipe(field(123, "Line price before discounts.")),
  priceSet: moneyBag(230).pipe(field(124, "Current unit price.")),
  totalDiscountSet: moneyBag(240).pipe(field(125, "Total discount for the line.")),
  parentRelationship: Schema.NullOr(Schema.String).pipe(
    field(126, "Parent relationship stored as JSON."),
  ),
});

export const CartSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique cart identifier.")),
  token: Schema.String.pipe(field(2, "Token for the cart.")),
  topic: Schema.Literals(["carts/create", "carts/update"]).pipe(
    field(3, "Webhook topic that last changed the cart."),
  ),
  lineItems: Schema.Array(CartLineItemSchema.annotate({ fieldId: 101 })).pipe(
    field(4, "Items in the cart."),
  ),
  note: Schema.NullOr(Schema.String).pipe(field(5, "Note added to the cart.")),
  updatedAt: Schema.Date.pipe(field(6, "Time when the cart was last changed.")),
  createdAt: Schema.Date.pipe(field(7, "Time when the cart was created.")),
}).annotate({
  description: "Latest state of each cart in a Shopify store.",
});

export type CartLineItem = Schema.Schema.Type<typeof CartLineItemSchema>;

export type Cart = Schema.Schema.Type<typeof CartSchema>;
