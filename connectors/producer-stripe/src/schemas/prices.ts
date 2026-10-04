import { Schema, Struct } from "effect";

import { Long, Metadata, UnixTime, deleted, field, version } from "./shared";

export const PriceSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique price identifier.")),
  version: version(2),
  created: UnixTime.pipe(field(3, "Time when the price was created.")),
  livemode: Schema.Boolean.pipe(field(4, "Whether the price exists in live mode.")),
  active: Schema.Boolean.pipe(field(5, "Whether the price can be used for new purchases.")),
  product: Schema.String.pipe(field(6, "Product the price belongs to.")),
  currency: Schema.String.pipe(field(7, "Three-letter currency code, in lowercase.")),
  type: Schema.String.pipe(field(8, "Price type: one_time or recurring.")),
  billing_scheme: Schema.String.pipe(field(9, "How the amount is computed: per_unit or tiered.")),
  unit_amount: Schema.NullOr(Long).pipe(
    field(10, "Unit amount in the smallest currency unit. Null for tiered prices."),
  ),
  unit_amount_decimal: Schema.NullOr(Schema.String).pipe(
    field(11, "Unit amount as a decimal string, for sub-cent amounts."),
  ),
  tiers_mode: Schema.NullOr(Schema.String).pipe(field(12, "Tier mode: graduated or volume.")),
  lookup_key: Schema.NullOr(Schema.String).pipe(field(13, "Key used to look up the price.")),
  nickname: Schema.NullOr(Schema.String).pipe(field(14, "Internal name of the price.")),
  tax_behavior: Schema.NullOr(Schema.String).pipe(
    field(15, "Whether tax is inclusive, exclusive, or unspecified."),
  ),
  recurring: Schema.NullOr(
    Schema.Struct({
      interval: Schema.String.pipe(field(100, "Billing interval: day, week, month, or year.")),
      interval_count: Long.pipe(field(101, "Number of intervals between bills.")),
      usage_type: Schema.String.pipe(field(102, "Usage type: licensed or metered.")),
      meter: Schema.optional(Schema.NullOr(Schema.String)).pipe(
        field(103, "Meter that tracks usage for metered prices."),
      ),
      trial_period_days: Schema.optional(Schema.NullOr(Long)).pipe(
        field(104, "Default trial length in days."),
      ),
    }),
  ).pipe(field(16, "Billing period of recurring prices.")),
  metadata: Metadata.pipe(field(17, "Key-value pairs set on the price.")),
  _deleted: deleted(18),
}).annotate({
  description: "Prices in a Stripe account, including inactive ones.",
});

export type Price = Schema.Schema.Type<typeof PriceSchema>;

export const PriceObjectSchema = PriceSchema.mapFields(Struct.omit(["version", "_deleted"]));

export type PriceObject = Schema.Schema.Type<typeof PriceObjectSchema>;
