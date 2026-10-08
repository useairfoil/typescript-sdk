import * as Schema from "effect/Schema";

import { address, attributes, discountAllocations, field, moneyBag, taxLines } from "../shared";

export const OrderCancelReasonSchema = Schema.Literals([
  "CUSTOMER",
  "DECLINED",
  "FRAUD",
  "INVENTORY",
  "STAFF",
  "OTHER",
]);

export const OrderFinancialStatusSchema = Schema.Literals([
  "PENDING",
  "AUTHORIZED",
  "PARTIALLY_PAID",
  "PARTIALLY_REFUNDED",
  "VOIDED",
  "PAID",
  "REFUNDED",
  "EXPIRED",
]);

export const DiscountApplicationTypeSchema = Schema.Literals([
  "DISCOUNT_CODE",
  "MANUAL",
  "AUTOMATIC",
  "SCRIPT",
]);

// Shopify deprecated ONE but still returns it for older orders.
export const DiscountAllocationMethodSchema = Schema.Literals(["ACROSS", "EACH", "ONE"]);

export const DiscountTargetSelectionSchema = Schema.Literals(["ALL", "ENTITLED", "EXPLICIT"]);

export const DiscountTargetTypeSchema = Schema.Literals(["LINE_ITEM", "SHIPPING_LINE"]);

export const DiscountValueTypeSchema = Schema.Literals(["PERCENTAGE", "FIXED_AMOUNT"]);

export const DiscountApplicationSchema = Schema.Struct({
  index: Schema.Int.pipe(field(161, "Position used by discount allocations.")),
  type: DiscountApplicationTypeSchema.pipe(field(162, "How the discount was applied.")),
  code: Schema.NullOr(Schema.String).pipe(field(163, "Discount code.")),
  title: Schema.NullOr(Schema.String).pipe(field(164, "Discount title.")),
  description: Schema.NullOr(Schema.String).pipe(field(165, "Manual discount description.")),
  allocationMethod: DiscountAllocationMethodSchema.pipe(field(166, "How the value is split.")),
  targetSelection: DiscountTargetSelectionSchema.pipe(field(167, "Which lines are targeted.")),
  targetType: DiscountTargetTypeSchema.pipe(field(168, "Kind of lines targeted.")),
  valueType: DiscountValueTypeSchema.pipe(field(169, "Whether the value is a percent.")),
  value: Schema.String.pipe(field(170, "Percent or amount in the customer currency.")),
});

export const ShippingLineSchema = Schema.Struct({
  id: Schema.NullOr(Schema.String).pipe(field(501, "Unique shipping line identifier.")),
  title: Schema.String.pipe(field(502, "Shipping method title.")),
  code: Schema.NullOr(Schema.String).pipe(field(503, "Shipping rate code.")),
  source: Schema.NullOr(Schema.String).pipe(field(504, "Source of the shipping rate.")),
  carrierIdentifier: Schema.NullOr(Schema.String).pipe(field(505, "Carrier service identifier.")),
  phone: Schema.NullOr(Schema.String).pipe(field(506, "Phone number for the shipping line.")),
  isRemoved: Schema.Boolean.pipe(field(507, "Whether the line was removed by an edit.")),
  originalPriceSet: moneyBag(520).pipe(field(508, "Price before discounts.")),
  discountedPriceSet: moneyBag(530).pipe(field(509, "Price after discounts.")),
  currentDiscountedPriceSet: moneyBag(540).pipe(
    field(510, "Price after discounts, edits, and refunds."),
  ),
  taxLines: taxLines(550).pipe(field(511, "Taxes on the shipping line.")),
  discountAllocations: discountAllocations(570).pipe(field(512, "Discounts on the line.")),
});

export const OrderLineItemSchema = Schema.Struct({
  id: Schema.String.pipe(field(601, "Unique line item identifier.")),
  name: Schema.String.pipe(field(602, "Product and variant name.")),
  title: Schema.String.pipe(field(603, "Product title.")),
  variantTitle: Schema.NullOr(Schema.String).pipe(field(604, "Variant title.")),
  sku: Schema.NullOr(Schema.String).pipe(field(605, "Stock keeping unit.")),
  vendor: Schema.NullOr(Schema.String).pipe(field(606, "Product vendor.")),
  productId: Schema.NullOr(Schema.String).pipe(field(607, "Product identifier.")),
  variantId: Schema.NullOr(Schema.String).pipe(field(608, "Product variant identifier.")),
  quantity: Schema.Int.pipe(field(609, "Quantity when the order was placed.")),
  currentQuantity: Schema.Int.pipe(field(610, "Quantity after removals and refunds.")),
  taxable: Schema.Boolean.pipe(field(611, "Whether the line item is taxable.")),
  requiresShipping: Schema.Boolean.pipe(field(612, "Whether the line item needs shipping.")),
  isGiftCard: Schema.Boolean.pipe(field(613, "Whether the line item is a gift card.")),
  originalUnitPriceSet: moneyBag(630).pipe(field(614, "Unit price before discounts.")),
  totalDiscountSet: moneyBag(640).pipe(field(615, "Total discount on the line.")),
  taxLines: taxLines(650).pipe(field(616, "Taxes on the line.")),
  discountAllocations: discountAllocations(670).pipe(field(617, "Discounts on the line.")),
  customAttributes: attributes(690).pipe(field(618, "Custom line properties.")),
});

export const OrderSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique order identifier.")),
  legacyResourceId: Schema.String.pipe(field(2, "Numeric order identifier stored as text.")),
  name: Schema.String.pipe(field(3, "Order name shown to the merchant.")),
  email: Schema.NullOr(Schema.String).pipe(field(4, "Email used for the order.")),
  phone: Schema.NullOr(Schema.String).pipe(field(5, "Phone used for the order.")),
  customerId: Schema.NullOr(Schema.String).pipe(field(6, "Customer identifier.")),
  customerLocale: Schema.NullOr(Schema.String).pipe(field(7, "Customer language.")),
  customerAcceptsMarketing: Schema.Boolean.pipe(field(8, "Whether the buyer accepts marketing.")),
  billingAddress: Schema.NullOr(address(100)).pipe(field(9, "Billing address.")),
  shippingAddress: Schema.NullOr(address(120)).pipe(field(10, "Shipping address.")),
  note: Schema.NullOr(Schema.String).pipe(field(11, "Order note.")),
  customAttributes: attributes(140).pipe(field(12, "Custom order attributes.")),
  tags: Schema.Array(Schema.String.annotate({ fieldId: 150 })).pipe(
    field(13, "Tags added to the order."),
  ),
  confirmationNumber: Schema.NullOr(Schema.String).pipe(field(14, "Confirmation number.")),
  poNumber: Schema.NullOr(Schema.String).pipe(field(15, "Purchase order number.")),
  sourceName: Schema.NullOr(Schema.String).pipe(field(16, "Channel that created the order.")),
  sourceIdentifier: Schema.NullOr(Schema.String).pipe(field(17, "Identifier from the source.")),
  appId: Schema.NullOr(Schema.String).pipe(field(18, "App that created the order.")),
  paymentGatewayNames: Schema.Array(Schema.String.annotate({ fieldId: 152 })).pipe(
    field(19, "Payment gateways used."),
  ),
  test: Schema.Boolean.pipe(field(20, "Whether the order is a test order.")),
  taxesIncluded: Schema.Boolean.pipe(field(21, "Whether prices include taxes.")),
  taxExempt: Schema.Boolean.pipe(field(22, "Whether the order is exempt from tax.")),
  dutiesIncluded: Schema.Boolean.pipe(field(23, "Whether prices include duties.")),
  estimatedTaxes: Schema.Boolean.pipe(field(24, "Whether taxes are estimates.")),
  totalWeight: Schema.NullOr(Schema.Int).pipe(field(25, "Total weight in grams.")),
  displayFinancialStatus: Schema.NullOr(OrderFinancialStatusSchema).pipe(
    field(26, "Payment status of the order."),
  ),
  cancelReason: Schema.NullOr(OrderCancelReasonSchema).pipe(
    field(27, "Reason the order was cancelled."),
  ),
  cancelledAt: Schema.NullOr(Schema.Date).pipe(field(28, "Time when the order was cancelled.")),
  closedAt: Schema.NullOr(Schema.Date).pipe(field(29, "Time when the order was closed.")),
  processedAt: Schema.Date.pipe(field(30, "Time when the order was processed.")),
  createdAt: Schema.Date.pipe(field(31, "Time when the order was created.")),
  updatedAt: Schema.Date.pipe(field(32, "Time when the order was last changed.")),
  currencyCode: Schema.String.pipe(field(33, "Shop currency code.")),
  presentmentCurrencyCode: Schema.String.pipe(field(34, "Customer currency code.")),
  discountCodes: Schema.Array(Schema.String.annotate({ fieldId: 151 })).pipe(
    field(35, "Discount codes used."),
  ),
  discountApplications: Schema.Array(DiscountApplicationSchema.annotate({ fieldId: 160 })).pipe(
    field(36, "Discounts applied to the order."),
  ),
  subtotalPriceSet: Schema.NullOr(moneyBag(200)).pipe(
    field(37, "Subtotal when the order was placed."),
  ),
  currentSubtotalPriceSet: moneyBag(210).pipe(field(38, "Subtotal after edits and refunds.")),
  totalDiscountsSet: Schema.NullOr(moneyBag(220)).pipe(
    field(39, "Discounts when the order was placed."),
  ),
  currentTotalDiscountsSet: moneyBag(230).pipe(field(40, "Discounts after edits and refunds.")),
  totalShippingPriceSet: moneyBag(240).pipe(field(41, "Shipping when the order was placed.")),
  currentShippingPriceSet: moneyBag(250).pipe(field(42, "Shipping after edits and refunds.")),
  totalTaxSet: Schema.NullOr(moneyBag(260)).pipe(field(43, "Tax when the order was placed.")),
  currentTotalTaxSet: moneyBag(270).pipe(field(44, "Tax after edits and refunds.")),
  originalTotalDutiesSet: Schema.NullOr(moneyBag(280)).pipe(
    field(45, "Duties when the order was placed."),
  ),
  currentTotalDutiesSet: Schema.NullOr(moneyBag(290)).pipe(
    field(46, "Duties after edits and refunds."),
  ),
  totalPriceSet: moneyBag(300).pipe(field(47, "Total when the order was placed.")),
  currentTotalPriceSet: moneyBag(310).pipe(field(48, "Total after edits and refunds.")),
  taxLines: taxLines(400).pipe(field(49, "Taxes when the order was placed.")),
  shippingLines: Schema.Array(ShippingLineSchema.annotate({ fieldId: 500 })).pipe(
    field(50, "Shipping lines, including removed ones."),
  ),
  lineItems: Schema.Array(OrderLineItemSchema.annotate({ fieldId: 600 })).pipe(
    field(51, "Line items in the order."),
  ),
  _deleted: Schema.optional(Schema.Boolean).pipe(field(52, "Whether the order was deleted.")),
}).annotate({
  description: "Orders in a Shopify store.",
});

export type Order = Schema.Schema.Type<typeof OrderSchema>;

export type OrderUpdate = Pick<Order, "id" | "updatedAt"> &
  Partial<Omit<Order, "id" | "updatedAt">>;

export type DiscountApplication = Schema.Schema.Type<typeof DiscountApplicationSchema>;
