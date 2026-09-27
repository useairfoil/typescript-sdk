import { Struct } from "effect";
import * as Schema from "effect/Schema";

import { addressFields, field } from "../shared";

export const CustomerStateSchema = Schema.Literals(["DECLINED", "DISABLED", "ENABLED", "INVITED"]);

export const EmailMarketingStateSchema = Schema.Literals([
  "INVALID",
  "NOT_SUBSCRIBED",
  "PENDING",
  "REDACTED",
  "SUBSCRIBED",
  "UNSUBSCRIBED",
]);

export const SmsMarketingStateSchema = Schema.Literals([
  "NOT_SUBSCRIBED",
  "PENDING",
  "SUBSCRIBED",
  "UNSUBSCRIBED",
  "REDACTED",
]);

export const MarketingOptInLevelSchema = Schema.Literals([
  "SINGLE_OPT_IN",
  "CONFIRMED_OPT_IN",
  "UNKNOWN",
]);

export const ConsentCollectedFromSchema = Schema.Literals(["SHOPIFY", "OTHER"]);

export const ProductSubscriberStatusSchema = Schema.Literals([
  "ACTIVE",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
  "NEVER_SUBSCRIBED",
  "PAUSED",
]);

export const CustomerAddressSchema = Schema.Struct({
  id: Schema.String.pipe(field(121, "Unique address identifier.")),
  ...addressFields(121),
});

export const CustomerSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique customer identifier.")),
  legacyResourceId: Schema.String.pipe(field(2, "Numeric customer identifier stored as text.")),
  firstName: Schema.NullOr(Schema.String).pipe(field(3, "First name.")),
  lastName: Schema.NullOr(Schema.String).pipe(field(4, "Last name.")),
  displayName: Schema.String.pipe(field(5, "Full name shown in Shopify.")),
  email: Schema.NullOr(Schema.String).pipe(field(6, "Default email address.")),
  emailMarketingState: Schema.NullOr(EmailMarketingStateSchema).pipe(
    field(7, "Email marketing consent state."),
  ),
  emailMarketingOptInLevel: Schema.NullOr(MarketingOptInLevelSchema).pipe(
    field(8, "Email marketing opt-in level."),
  ),
  emailMarketingUpdatedAt: Schema.NullOr(Schema.Date).pipe(
    field(9, "Time when email marketing consent last changed."),
  ),
  phone: Schema.NullOr(Schema.String).pipe(field(10, "Default phone number.")),
  smsMarketingState: Schema.NullOr(SmsMarketingStateSchema).pipe(
    field(11, "SMS marketing consent state."),
  ),
  smsMarketingOptInLevel: Schema.NullOr(MarketingOptInLevelSchema).pipe(
    field(12, "SMS marketing opt-in level."),
  ),
  smsMarketingUpdatedAt: Schema.NullOr(Schema.Date).pipe(
    field(13, "Time when SMS marketing consent last changed."),
  ),
  smsMarketingCollectedFrom: Schema.NullOr(ConsentCollectedFromSchema).pipe(
    field(14, "Where SMS marketing consent was collected."),
  ),
  note: Schema.NullOr(Schema.String).pipe(field(15, "Merchant note about the customer.")),
  state: CustomerStateSchema.pipe(field(16, "Customer account state.")),
  verifiedEmail: Schema.Boolean.pipe(field(17, "Whether the email address is verified.")),
  taxExempt: Schema.Boolean.pipe(field(18, "Whether the customer is exempt from tax.")),
  taxExemptions: Schema.Array(Schema.String.annotate({ fieldId: 100 })).pipe(
    field(19, "Tax exemptions that apply to the customer."),
  ),
  tags: Schema.Array(Schema.String.annotate({ fieldId: 101 })).pipe(
    field(20, "Tags added to the customer."),
  ),
  locale: Schema.NullOr(Schema.String).pipe(field(21, "Customer language. Set by backfill only.")),
  numberOfOrders: Schema.Int.pipe(field(22, "Number of orders the customer placed.")),
  amountSpent: Schema.Struct({
    amount: Schema.String.pipe(field(111, "Amount spent.")),
    currencyCode: Schema.String.pipe(field(112, "Shop currency code.")),
  }).pipe(field(23, "Total amount spent in the shop currency.")),
  lastOrderId: Schema.NullOr(Schema.String).pipe(field(24, "Most recent order identifier.")),
  productSubscriberStatus: Schema.NullOr(ProductSubscriberStatusSchema).pipe(
    field(25, "Subscription status for products. Set by backfill only."),
  ),
  dataSaleOptOut: Schema.NullOr(Schema.Boolean).pipe(
    field(26, "Whether the customer opted out of data sale. Set by backfill only."),
  ),
  defaultAddressId: Schema.NullOr(Schema.String).pipe(field(27, "Default address identifier.")),
  addresses: Schema.Array(CustomerAddressSchema.annotate({ fieldId: 120 })).pipe(
    field(28, "Saved addresses."),
  ),
  createdAt: Schema.Date.pipe(field(29, "Time when the customer was created.")),
  updatedAt: Schema.Date.pipe(field(30, "Time when the customer was last changed.")),
  _af_deleted: Schema.optional(Schema.Boolean).pipe(field(31, "Whether the customer was deleted.")),
}).annotate({
  description: "Customers in a Shopify store.",
});

export type Customer = Schema.Schema.Type<typeof CustomerSchema>;

// Webhook rows only set the fields they carry. Backfill-only fields keep their values.
export const CustomerUpdateSchema = CustomerSchema.mapFields(
  Struct.mapOmit(["id", "updatedAt", "_af_deleted"], Schema.optionalKey),
);

export type CustomerUpdate = Schema.Schema.Type<typeof CustomerUpdateSchema>;
