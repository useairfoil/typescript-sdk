import * as Schema from "effect/Schema";

import { fromRest, gid, normalizeAmount, RestAddressSchema, upper } from "../shared";
import {
  ConsentCollectedFromSchema,
  CustomerStateSchema,
  type CustomerUpdate,
  CustomerUpdateSchema,
  EmailMarketingStateSchema,
  MarketingOptInLevelSchema,
  SmsMarketingStateSchema,
} from "./row";

const CustomerWebhookAddressSchema = Schema.Struct({
  id: Schema.Number,
  ...RestAddressSchema.fields,
});

export const CustomerWebhookPayloadSchema = Schema.Struct({
  id: Schema.Number,
  admin_graphql_api_id: Schema.String,
  created_at: Schema.DateFromString,
  updated_at: Schema.DateFromString,
  first_name: Schema.NullOr(Schema.String),
  last_name: Schema.NullOr(Schema.String),
  state: upper(CustomerStateSchema),
  note: Schema.NullOr(Schema.String),
  verified_email: Schema.Boolean,
  tax_exempt: Schema.Boolean,
  tax_exemptions: Schema.Array(Schema.String),
  email: Schema.optional(Schema.NullOr(Schema.String)),
  phone: Schema.optional(Schema.NullOr(Schema.String)),
  addresses: Schema.optional(Schema.Array(CustomerWebhookAddressSchema)),
  default_address: Schema.optional(Schema.NullOr(CustomerWebhookAddressSchema)),
});

export const CustomerPurchaseSummaryPayloadSchema = Schema.Struct({
  customerId: Schema.String,
  numberOfOrders: Schema.Int,
  amountSpent: Schema.Struct({ amount: Schema.String, currencyCode: Schema.String }),
  lastOrderId: Schema.NullOr(Schema.String),
  occurredAt: Schema.DateFromString,
});

export const CustomerEmailConsentPayloadSchema = Schema.Struct({
  customer_id: Schema.Number,
  email_address: Schema.NullOr(Schema.String),
  email_marketing_consent: Schema.Struct({
    state: upper(EmailMarketingStateSchema),
    opt_in_level: Schema.NullOr(upper(MarketingOptInLevelSchema)),
    consent_updated_at: Schema.NullOr(Schema.DateFromString),
  }),
});

export const CustomerSmsConsentPayloadSchema = Schema.Struct({
  id: Schema.Number,
  phone: Schema.NullOr(Schema.String),
  sms_marketing_consent: Schema.Struct({
    state: Schema.NullOr(upper(SmsMarketingStateSchema)),
    opt_in_level: Schema.NullOr(upper(MarketingOptInLevelSchema)),
    consent_updated_at: Schema.NullOr(Schema.DateFromString),
    consent_collected_from: Schema.NullOr(upper(ConsentCollectedFromSchema)),
  }),
});

export const CustomerTagsPayloadSchema = Schema.Struct({
  customerId: Schema.String,
  tags: Schema.Array(Schema.String),
  occurredAt: Schema.DateFromString,
});

export const CustomerDeleteWebhookPayloadSchema = Schema.Struct({ id: Schema.Number });

type CustomerWebhookPayload = Schema.Schema.Type<typeof CustomerWebhookPayloadSchema>;

type CustomerPurchaseSummaryPayload = Schema.Schema.Type<
  typeof CustomerPurchaseSummaryPayloadSchema
>;

type CustomerEmailConsentPayload = Schema.Schema.Type<typeof CustomerEmailConsentPayloadSchema>;

type CustomerSmsConsentPayload = Schema.Schema.Type<typeof CustomerSmsConsentPayloadSchema>;

export const fromCustomerWebhook = (payload: CustomerWebhookPayload): CustomerUpdate => ({
  id: payload.admin_graphql_api_id,
  updatedAt: payload.updated_at,
  legacyResourceId: String(payload.id),
  firstName: payload.first_name ?? "",
  lastName: payload.last_name ?? "",
  // Same fallback Shopify documents for displayName.
  displayName:
    [payload.first_name, payload.last_name].filter(Boolean).join(" ") ||
    payload.email ||
    payload.phone ||
    "",
  ...(payload.email === undefined ? {} : { email: payload.email ?? "" }),
  ...(payload.phone === undefined ? {} : { phone: payload.phone ?? "" }),
  note: payload.note ?? "",
  state: payload.state,
  verifiedEmail: payload.verified_email,
  taxExempt: payload.tax_exempt,
  taxExemptions: payload.tax_exemptions,
  ...(payload.addresses === undefined
    ? {}
    : {
        addresses: payload.addresses.map(({ id, ...address }) => ({
          id: gid("MailingAddress", id),
          ...fromRest.addressWithoutCoordinates(address),
        })),
      }),
  ...(payload.default_address === undefined
    ? {}
    : {
        defaultAddressId:
          payload.default_address === null ? "" : gid("MailingAddress", payload.default_address.id),
      }),
  createdAt: payload.created_at,
});

export const fromCustomerPurchaseSummary = (
  payload: CustomerPurchaseSummaryPayload,
): CustomerUpdate => ({
  id: payload.customerId,
  updatedAt: payload.occurredAt,
  numberOfOrders: payload.numberOfOrders,
  amountSpent: {
    amount: normalizeAmount(payload.amountSpent.amount),
    currencyCode: payload.amountSpent.currencyCode,
  },
  lastOrderId: payload.lastOrderId ?? "",
});

export const fromCustomerEmailConsent = (
  payload: CustomerEmailConsentPayload,
  updatedAt: Date,
): CustomerUpdate => ({
  id: gid("Customer", payload.customer_id),
  updatedAt,
  email: payload.email_address ?? "",
  emailMarketingState: payload.email_marketing_consent.state,
  emailMarketingOptInLevel: payload.email_marketing_consent.opt_in_level,
  emailMarketingUpdatedAt: payload.email_marketing_consent.consent_updated_at,
});

export const fromCustomerSmsConsent = (
  payload: CustomerSmsConsentPayload,
  updatedAt: Date,
): CustomerUpdate => ({
  id: gid("Customer", payload.id),
  updatedAt,
  phone: payload.phone ?? "",
  smsMarketingState: payload.sms_marketing_consent.state,
  smsMarketingOptInLevel: payload.sms_marketing_consent.opt_in_level,
  smsMarketingUpdatedAt: payload.sms_marketing_consent.consent_updated_at,
  smsMarketingCollectedFrom: payload.sms_marketing_consent.consent_collected_from,
});

export const CustomerEventSchema = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("upsert"),
    row: CustomerUpdateSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("refresh-tags"),
    id: Schema.String,
    version: Schema.Date,
  }),
  Schema.Struct({
    _tag: Schema.Literal("delete"),
    id: Schema.String,
    version: Schema.Date,
  }),
]);
