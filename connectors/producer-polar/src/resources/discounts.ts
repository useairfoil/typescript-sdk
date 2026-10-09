import { Option, Schema } from "effect";

import { DiscountAmountsJsonSchema, MetadataJsonSchema, date, field, nullableDate } from "./shared";

const DiscountProductSchema = Schema.Struct({
  id: Schema.String.pipe(field(302, "Product the discount applies to.")),
  name: Schema.String.pipe(field(303, "Product name.")),
});

const DiscountInputSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique discount identifier.")),
  created_at: date(2, "Time when the discount was created."),
  modified_at: nullableDate(3, "Time when the discount was last changed."),
  name: Schema.String.pipe(field(4, "Discount name.")),
  code: Schema.NullOr(Schema.String).pipe(field(5, "Code customers enter at checkout.")),
  type: Schema.Literals(["fixed", "percentage"]).pipe(field(6, "Discount type.")),
  duration: Schema.Literals(["once", "forever", "repeating"]).pipe(
    field(7, "How long the discount applies."),
  ),
  duration_in_months: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(8, "Months a repeating discount applies."),
  ),
  amount: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(9, "Fixed discount in the smallest currency unit."),
  ),
  currency: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    field(10, "Currency of a fixed discount."),
  ),
  amounts: Schema.optional(DiscountAmountsJsonSchema).pipe(
    field(11, "Fixed discount amounts by currency stored as JSON."),
  ),
  basis_points: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(12, "Percentage discount in basis points."),
  ),
  starts_at: nullableDate(13, "Time when the discount starts."),
  ends_at: nullableDate(14, "Time when the discount ends."),
  max_redemptions: Schema.NullOr(Schema.Int).pipe(field(15, "Maximum number of redemptions.")),
  max_redemptions_per_customer: Schema.optional(Schema.NullOr(Schema.Int)).pipe(
    field(16, "Maximum redemptions for each customer."),
  ),
  redemptions_count: Schema.Int.pipe(field(17, "Number of times the discount was redeemed.")),
  organization_id: Schema.String.pipe(field(18, "Organization that owns the discount.")),
  metadata: MetadataJsonSchema.pipe(field(19, "Discount metadata stored as JSON.")),
  products: Schema.Array(DiscountProductSchema.annotate({ fieldId: 301 })).pipe(
    field(20, "Products the discount is limited to."),
  ),
  _deleted: Schema.optional(Schema.Boolean).pipe(field(22, "Whether the discount was deleted.")),
});

export const DiscountSchema = DiscountInputSchema.pipe(
  Schema.extendTo(
    {
      version: Schema.Date.pipe(field(21, "Time used to order discount changes.")),
    },
    { version: (row) => Option.some(row.modified_at ?? row.created_at) },
  ),
).annotate({
  description: "Discounts in a Polar organization.",
});

export type Discount = Schema.Schema.Type<typeof DiscountSchema>;
