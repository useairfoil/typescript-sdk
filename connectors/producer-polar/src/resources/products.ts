import { Option, Schema } from "effect";

import { MetadataJsonSchema, date, field, nullableDate } from "./shared";

const intervalLiterals = ["day", "week", "month", "year"] as const;

const tierTypeLiterals = ["volume", "graduated"] as const;

const PriceTiersJsonSchema = Schema.flip(
  Schema.fromJsonString(
    Schema.Struct({
      type: Schema.Literals(tierTypeLiterals),
      tiers: Schema.Array(
        Schema.Struct({
          bound: Schema.optional(Schema.NullOr(Schema.Int)),
          unit_amount: Schema.String,
        }),
      ),
    }),
  ),
);

const SeatTiersJsonSchema = Schema.flip(
  Schema.fromJsonString(
    Schema.Struct({
      seat_tier_type: Schema.optional(Schema.Literals(tierTypeLiterals)),
      tiers: Schema.Array(
        Schema.Struct({
          min_seats: Schema.Int,
          max_seats: Schema.optional(Schema.NullOr(Schema.Int)),
          price_per_seat: Schema.Int,
        }),
      ),
      minimum_seats: Schema.Int,
      maximum_seats: Schema.NullOr(Schema.Int),
    }),
  ),
);

export const ProductPriceSchema = Schema.Struct({
  id: Schema.String.pipe(field(202, "Unique price identifier.")),
  created_at: date(203, "Time when the price was created."),
  modified_at: nullableDate(204, "Time when the price was last changed."),
  amount_type: Schema.Literals([
    "fixed",
    "custom",
    "seat_based",
    "unit_based",
    "metered_unit",
    "metered_tiers",
  ]).pipe(field(205, "How the price amount is set.")),
  price_currency: Schema.String.pipe(field(206, "Three-letter currency code.")),
  is_archived: Schema.Boolean.pipe(field(207, "Whether the price is archived.")),
  tax_behavior: Schema.NullOr(Schema.Literals(["location", "inclusive", "exclusive"])).pipe(
    field(208, "How tax is applied."),
  ),
  source: Schema.Literals(["catalog", "ad_hoc"]).pipe(field(209, "Where the price came from.")),
  price_amount: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(210, "Fixed price in the smallest currency unit."),
  ),
  minimum_amount: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(211, "Minimum amount for a custom price."),
  ),
  maximum_amount: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(212, "Maximum amount for a custom price."),
  ),
  preset_amount: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(213, "Suggested amount for a custom price."),
  ),
  unit_amount: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(214, "Metered price per unit as a decimal string."),
  ),
  cap_amount: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(215, "Maximum metered charge per period."),
  ),
  meter_id: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(216, "Meter used by a metered price."),
  ),
  tiers: Schema.optional(PriceTiersJsonSchema).pipe(
    field(217, "Unit or metered price tiers stored as JSON."),
  ),
  seat_tiers: Schema.optional(SeatTiersJsonSchema).pipe(
    field(218, "Seat price tiers stored as JSON."),
  ),
  minimum_units: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(219, "Minimum units that can be bought."),
  ),
  maximum_units: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(220, "Maximum units that can be bought."),
  ),
});

const ProductInputSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique product identifier.")),
  created_at: date(2, "Time when the product was created."),
  modified_at: nullableDate(3, "Time when the product was last changed."),
  name: Schema.String.pipe(field(4, "Product name.")),
  description: Schema.NullOr(Schema.String).pipe(field(5, "Product description.")),
  visibility: Schema.Literals(["draft", "private", "public"]).pipe(
    field(6, "Where the product is shown."),
  ),
  is_recurring: Schema.Boolean.pipe(field(7, "Whether the product is a subscription.")),
  is_archived: Schema.Boolean.pipe(field(8, "Whether the product is archived.")),
  recurring_interval: Schema.NullOr(Schema.Literals(intervalLiterals)).pipe(
    field(9, "Unit used for recurring billing."),
  ),
  recurring_interval_count: Schema.NullOr(Schema.Int).pipe(
    field(10, "Number of recurring billing intervals."),
  ),
  trial_interval: Schema.NullOr(Schema.Literals(intervalLiterals)).pipe(
    field(11, "Unit for the trial."),
  ),
  trial_interval_count: Schema.NullOr(Schema.Int).pipe(field(12, "Number of trial intervals.")),
  meter_interval: Schema.optional(Schema.NullOr(Schema.Literals(intervalLiterals))).pipe(
    field(13, "Unit used for metered billing."),
  ),
  meter_interval_count: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(14, "Number of metered billing intervals."),
  ),
  organization_id: Schema.String.pipe(field(15, "Organization that owns the product.")),
  metadata: MetadataJsonSchema.pipe(field(16, "Product metadata stored as JSON.")),
  prices: Schema.Array(ProductPriceSchema.annotate({ fieldId: 201 })).pipe(
    field(17, "Prices for the product."),
  ),
});

export const ProductSchema = ProductInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(18, "Time used to order product changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Products in a Polar organization.",
});

export type ProductPrice = Schema.Schema.Type<typeof ProductPriceSchema>;

export type Product = Schema.Schema.Type<typeof ProductSchema>;
