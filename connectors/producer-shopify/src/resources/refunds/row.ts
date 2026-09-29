import * as Schema from "effect/Schema";

import { field, moneyBag } from "../shared";

export const TransactionKindSchema = Schema.Literals([
  "SALE",
  "CAPTURE",
  "AUTHORIZATION",
  "VOID",
  "REFUND",
  "CHANGE",
  "EMV_AUTHORIZATION",
  "SUGGESTED_REFUND",
]);

export const TransactionStatusSchema = Schema.Literals([
  "SUCCESS",
  "FAILURE",
  "PENDING",
  "ERROR",
  "AWAITING_RESPONSE",
  "UNKNOWN",
]);

export const RestockTypeSchema = Schema.Literals([
  "RETURN",
  "CANCEL",
  "LEGACY_RESTOCK",
  "NO_RESTOCK",
]);

export const RefundSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique refund identifier.")),
  legacyResourceId: Schema.String.pipe(field(2, "Numeric refund identifier stored as text.")),
  orderId: Schema.String.pipe(field(3, "Refunded order identifier.")),
  note: Schema.NullOr(Schema.String).pipe(field(4, "Refund note.")),
  createdAt: Schema.NullOr(Schema.Date).pipe(field(5, "Time when the refund was created.")),
  processedAt: Schema.Date.pipe(field(6, "Time when the refund was processed.")),
  transactions: Schema.Array(
    Schema.Struct({
      id: Schema.String.pipe(field(101, "Unique transaction identifier.")),
      kind: TransactionKindSchema.pipe(field(102, "Kind of transaction.")),
      status: TransactionStatusSchema.pipe(field(103, "Status reported for the transaction.")),
      amount: Schema.String.pipe(field(104, "Amount in the customer currency.")),
      currencyCode: Schema.String.pipe(field(105, "Customer currency code.")),
      gateway: Schema.NullOr(Schema.String).pipe(field(106, "Payment gateway.")),
      test: Schema.Boolean.pipe(field(107, "Whether the transaction is a test.")),
      errorCode: Schema.NullOr(Schema.String).pipe(field(108, "Gateway error code.")),
      parentTransactionId: Schema.NullOr(Schema.String).pipe(
        field(109, "Transaction this one refunds."),
      ),
      createdAt: Schema.Date.pipe(field(110, "Time when the transaction was created.")),
      processedAt: Schema.NullOr(Schema.Date).pipe(
        field(111, "Time when the transaction was processed."),
      ),
    }).annotate({ fieldId: 100 }),
  ).pipe(field(7, "Transactions that move the refunded money.")),
  refundLineItems: Schema.Array(
    Schema.Struct({
      id: Schema.NullOr(Schema.String).pipe(field(201, "Unique refund line item identifier.")),
      lineItemId: Schema.String.pipe(field(202, "Refunded order line item identifier.")),
      quantity: Schema.Int.pipe(field(203, "Quantity refunded.")),
      restockType: RestockTypeSchema.pipe(field(204, "How the items were restocked.")),
      locationId: Schema.NullOr(Schema.String).pipe(field(205, "Restock location identifier.")),
      subtotalSet: moneyBag(210).pipe(field(206, "Refunded subtotal.")),
      totalTaxSet: moneyBag(220).pipe(field(207, "Refunded tax.")),
    }).annotate({ fieldId: 200 }),
  ).pipe(field(8, "Refunded order line items.")),
  refundShippingLines: Schema.Array(
    Schema.Struct({
      id: Schema.String.pipe(field(301, "Unique refund shipping line identifier.")),
      shippingLineId: Schema.NullOr(Schema.String).pipe(field(302, "Refunded shipping line.")),
      subtotalAmountSet: moneyBag(310).pipe(field(303, "Refunded shipping amount.")),
    }).annotate({ fieldId: 300 }),
  ).pipe(field(9, "Refunded shipping.")),
  orderAdjustments: Schema.Array(
    Schema.Struct({
      id: Schema.String.pipe(field(401, "Unique order adjustment identifier.")),
      reason: Schema.NullOr(Schema.String).pipe(field(402, "Reason for the adjustment.")),
      amountSet: moneyBag(410).pipe(field(403, "Adjustment amount.")),
      taxAmountSet: moneyBag(420).pipe(field(404, "Tax on the adjustment.")),
    }).annotate({ fieldId: 400 }),
  ).pipe(field(10, "Refund discrepancy adjustments.")),
  duties: Schema.Array(
    Schema.Struct({
      dutyId: Schema.NullOr(Schema.String).pipe(field(501, "Refunded duty identifier.")),
      amountSet: moneyBag(510).pipe(field(502, "Refunded duty amount.")),
    }).annotate({ fieldId: 500 }),
  ).pipe(field(11, "Refunded duties.")),
}).annotate({
  description: "Refunds on orders in a Shopify store.",
});

export type Refund = Schema.Schema.Type<typeof RefundSchema>;
