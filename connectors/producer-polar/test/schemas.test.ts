import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { CheckoutSchema, CustomerSchema, WebhookPayloadSchema } from "../src/index";

const checkout = {
  id: "checkout_1",
  created_at: "2026-01-01T00:00:00Z",
  modified_at: "2026-01-02T00:00:00Z",
  payment_processor: "stripe",
  status: "open",
  expires_at: "2026-01-03T00:00:00Z",
  amount: 1_000,
  discount_amount: 0,
  net_amount: 1_000,
  tax_amount: null,
  tax_behavior: null,
  total_amount: 1_000,
  currency: "usd",
  organization_id: "organization_1",
  product_id: "product_1",
  product_price_id: "price_1",
  discount_id: null,
  subscription_id: null,
  customer_id: null,
  external_customer_id: null,
  allow_discount_codes: true,
  require_billing_address: false,
  is_discount_applicable: false,
  is_free_product_price: false,
  is_payment_required: true,
  is_payment_setup_required: false,
  is_payment_form_required: true,
  is_business_customer: false,
  customer_name: null,
  customer_email: null,
  customer_billing_name: null,
  customer_billing_address: null,
  allow_trial: false,
  active_trial_interval: null,
  active_trial_interval_count: null,
  trial_end: null,
  trial_interval: null,
  trial_interval_count: null,
  metadata: {},
  client_secret: "must-not-be-published",
  url: "https://polar.sh/checkout/must-not-be-published",
  success_url: "https://polar.sh/checkout/must-not-be-published/confirmation",
  customer_ip_address: "192.0.2.1",
  payment_processor_metadata: { token: "must-not-be-published" },
};

const customer = {
  id: "customer_1",
  created_at: "2026-01-01T00:00:00Z",
  modified_at: null,
  type: "individual",
  deleted_at: null,
  external_id: null,
  email: "customer@example.com",
  email_verified: true,
  name: "Customer",
  billing_name: null,
  billing_address: null,
  organization_id: "organization_1",
  avatar_url: null,
  metadata: {},
};

const subscription = {
  id: "subscription_1",
  created_at: "2026-01-01T00:00:00Z",
  modified_at: null,
  amount: 1_000,
  currency: "usd",
  recurring_interval: "month",
  recurring_interval_count: 1,
  status: "paused",
  current_period_start: "2026-01-01T00:00:00Z",
  current_period_end: "2026-02-01T00:00:00Z",
  current_meter_period_start: null,
  current_meter_period_end: null,
  trial_start: null,
  trial_end: null,
  cancel_at_period_end: false,
  canceled_at: null,
  started_at: "2026-01-01T00:00:00Z",
  ends_at: null,
  ended_at: null,
  pause_at_period_end: false,
  paused_at: "2026-01-10T00:00:00Z",
  resumes_at: null,
  customer_id: "customer_1",
  product_id: "product_1",
  discount_id: null,
  checkout_id: "checkout_1",
  customer_cancellation_reason: null,
  customer_cancellation_comment: null,
  metadata: {},
};

describe("producer-polar schemas", () => {
  it.effect("adds the provider modification time as the row version", () =>
    Effect.gen(function* () {
      const row = yield* Schema.decodeUnknownEffect(CheckoutSchema)(checkout);

      expect(row.version).toBe(checkout.modified_at);
    }),
  );

  it.effect("falls back to the creation time when modified_at is null", () =>
    Effect.gen(function* () {
      const row = yield* Schema.decodeUnknownEffect(CustomerSchema)(customer);

      expect(row.version).toBe(customer.created_at);
    }),
  );

  it.effect("does not retain checkout credentials or processor details", () =>
    Effect.gen(function* () {
      const row = yield* Schema.decodeUnknownEffect(CheckoutSchema)(checkout);

      expect(row).not.toHaveProperty("client_secret");
      expect(row).not.toHaveProperty("url");
      expect(row).not.toHaveProperty("success_url");
      expect(row).not.toHaveProperty("customer_ip_address");
      expect(row).not.toHaveProperty("payment_processor_metadata");
    }),
  );

  it.effect("accepts the current paused and resumed subscription events", () =>
    Effect.gen(function* () {
      const paused = yield* Schema.decodeUnknownEffect(WebhookPayloadSchema)({
        type: "subscription.paused",
        timestamp: "2026-01-10T00:00:00Z",
        data: subscription,
      });
      const resumed = yield* Schema.decodeUnknownEffect(WebhookPayloadSchema)({
        type: "subscription.resumed",
        timestamp: "2026-01-11T00:00:00Z",
        data: { ...subscription, status: "active", resumed_at: "2026-01-11T00:00:00Z" },
      });

      expect(paused.type).toBe("subscription.paused");
      expect(resumed.type).toBe("subscription.resumed");
    }),
  );

  it.effect("rejects undocumented checkout statuses", () =>
    Effect.gen(function* () {
      const result = yield* Schema.decodeUnknownEffect(CheckoutSchema)({
        ...checkout,
        status: "unknown",
      }).pipe(Effect.match({ onFailure: () => false, onSuccess: () => true }));

      expect(result).toBe(false);
    }),
  );
});
