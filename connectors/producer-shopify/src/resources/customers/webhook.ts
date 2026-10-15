import * as Schema from "effect/Schema";

// Customer webhooks leave fields out, so the handler reads the customer again.

export const CustomerWebhookPayloadSchema = Schema.Struct({
  admin_graphql_api_id: Schema.String,
  updated_at: Schema.DateFromString,
});

export const CustomerPurchaseSummaryPayloadSchema = Schema.Struct({
  customerId: Schema.String,
  occurredAt: Schema.DateFromString,
});

export const CustomerEmailConsentPayloadSchema = Schema.Struct({ customer_id: Schema.Number });

export const CustomerSmsConsentPayloadSchema = Schema.Struct({ id: Schema.Number });

export const CustomerTagsPayloadSchema = Schema.Struct({
  customerId: Schema.String,
  occurredAt: Schema.DateFromString,
});

export const CustomerDeleteWebhookPayloadSchema = Schema.Struct({ id: Schema.Number });

export const CustomerEventSchema = Schema.Struct({
  _tag: Schema.Literals(["refresh", "delete"]),
  id: Schema.String,
  version: Schema.Date,
});
