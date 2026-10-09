import { Schema, Struct } from "effect";

import { Long, Metadata, UnixTime, address, field, version } from "./shared";

export const ChargeSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique charge identifier.")),
  version: version(2),
  created: UnixTime.pipe(field(3, "Time when the charge was created.")),
  livemode: Schema.Boolean.pipe(field(4, "Whether the charge exists in live mode.")),
  amount: Long.pipe(field(5, "Amount to collect, in the smallest currency unit.")),
  amount_captured: Long.pipe(field(6, "Amount captured.")),
  amount_refunded: Long.pipe(field(7, "Amount refunded.")),
  currency: Schema.String.pipe(field(8, "Three-letter currency code, in lowercase.")),
  status: Schema.String.pipe(field(9, "Status: succeeded, pending, or failed.")),
  paid: Schema.Boolean.pipe(field(10, "Whether the charge succeeded or was authorized.")),
  captured: Schema.Boolean.pipe(field(11, "Whether the charge was captured.")),
  refunded: Schema.Boolean.pipe(field(12, "Whether the charge was fully refunded.")),
  disputed: Schema.Boolean.pipe(field(13, "Whether the charge was disputed.")),
  customer: Schema.NullOr(Schema.String).pipe(field(14, "Customer who was charged, if any.")),
  payment_intent: Schema.NullOr(Schema.String).pipe(field(15, "Payment intent of the charge.")),
  payment_method: Schema.NullOr(Schema.String).pipe(field(16, "Payment method used.")),
  balance_transaction: Schema.NullOr(Schema.String).pipe(
    field(17, "Balance transaction for the charge."),
  ),
  description: Schema.NullOr(Schema.String).pipe(field(18, "Free-text description.")),
  failure_code: Schema.NullOr(Schema.String).pipe(field(19, "Error code for failed charges.")),
  failure_message: Schema.NullOr(Schema.String).pipe(
    field(20, "Error message for failed charges."),
  ),
  payment_method_details: Schema.NullOr(
    Schema.Struct({
      type: Schema.String.pipe(field(100, "Payment method type, such as card.")),
      card: Schema.optional(
        Schema.NullOr(
          Schema.Struct({
            brand: Schema.NullOr(Schema.String).pipe(field(102, "Card brand.")),
            country: Schema.NullOr(Schema.String).pipe(field(103, "Two-letter card country.")),
            funding: Schema.NullOr(Schema.String).pipe(
              field(104, "Funding type: credit, debit, prepaid, or unknown."),
            ),
            last4: Schema.NullOr(Schema.String).pipe(field(105, "Last four card digits.")),
            exp_month: Long.pipe(field(106, "Expiry month.")),
            exp_year: Long.pipe(field(107, "Expiry year.")),
            // Stripe leaves this out for restricted keys without payment method access.
            fingerprint: Schema.optional(Schema.NullOr(Schema.String)).pipe(
              field(108, "Stripe's fingerprint of the card number, for finding duplicates."),
            ),
          }),
        ),
      ).pipe(field(101, "Card details. Only set for card payments.")),
    }),
  ).pipe(field(21, "Payment method details at the time of the charge.")),
  outcome: Schema.NullOr(
    Schema.Struct({
      type: Schema.String.pipe(field(110, "Outcome type, such as authorized or issuer_declined.")),
      network_status: Schema.NullOr(Schema.String).pipe(field(111, "Card network result.")),
      reason: Schema.NullOr(Schema.String).pipe(field(112, "Reason for a decline or block.")),
      risk_level: Schema.optional(Schema.NullOr(Schema.String)).pipe(
        field(113, "Radar risk level."),
      ),
      seller_message: Schema.NullOr(Schema.String).pipe(
        field(114, "Explanation of the outcome for the seller."),
      ),
    }),
  ).pipe(field(22, "Whether the payment was accepted, and why.")),
  metadata: Metadata.pipe(field(23, "Key-value pairs set on the charge.")),
  billing_details: Schema.Struct({
    name: Schema.NullOr(Schema.String).pipe(field(140, "Payer name.")),
    email: Schema.NullOr(Schema.String).pipe(field(141, "Payer email.")),
    phone: Schema.NullOr(Schema.String).pipe(field(142, "Payer phone number.")),
    address: Schema.NullOr(address(144)).pipe(field(143, "Billing address.")),
  }).pipe(field(24, "Billing details of the payment method at the time of the charge.")),
  receipt_email: Schema.NullOr(Schema.String).pipe(field(25, "Email the receipt was sent to.")),
}).annotate({
  description: "Charges in a Stripe account.",
});

export type Charge = Schema.Schema.Type<typeof ChargeSchema>;

export const ChargeObjectSchema = ChargeSchema.mapFields(Struct.omit(["version"]));

export type ChargeObject = Schema.Schema.Type<typeof ChargeObjectSchema>;
