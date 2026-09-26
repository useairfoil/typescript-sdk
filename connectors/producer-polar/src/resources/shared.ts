import { Iceberg } from "@useairfoil/connector-kit";
import { Schema } from "effect";

export const field = (fieldId: number, description: string) =>
  Iceberg.field(fieldId, { description });

const MetadataSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
);

const CustomFieldDataSchema = Schema.Record(
  Schema.String,
  Schema.NullOr(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])),
);

export const MetadataJsonSchema = Schema.flip(Schema.fromJsonString(MetadataSchema));

export const CustomFieldDataJsonSchema = Schema.flip(Schema.fromJsonString(CustomFieldDataSchema));

export const DiscountAmountsJsonSchema = Schema.flip(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Int)),
);

export const date = (fieldId: number, description: string) =>
  Schema.DateFromString.pipe(field(fieldId, description));

export const nullableDate = (fieldId: number, description: string) =>
  Schema.NullOr(Schema.DateFromString).pipe(field(fieldId, description));

export const makeAddressSchema = (baseId: number) => {
  const id = Iceberg.ids(baseId);

  return Schema.Struct({
    country: Schema.String.pipe(field(id(1), "Country code for the address.")),
    line1: Schema.optional(Schema.NullOr(Schema.String)).pipe(
      field(id(2), "First line of the address."),
    ),
    line2: Schema.optional(Schema.NullOr(Schema.String)).pipe(
      field(id(3), "Second line of the address."),
    ),
    postal_code: Schema.optional(Schema.NullOr(Schema.String)).pipe(
      field(id(4), "Postal code for the address."),
    ),
    city: Schema.optional(Schema.NullOr(Schema.String)).pipe(field(id(5), "City for the address.")),
    state: Schema.optional(Schema.NullOr(Schema.String)).pipe(
      field(id(6), "State or region for the address."),
    ),
  });
};

export const AddressSchema = makeAddressSchema(100);

export const OrderItemSchema = Schema.Struct({
  id: Schema.String.pipe(field(202, "Unique order item identifier.")),
  created_at: date(203, "Time when the order item was created."),
  modified_at: nullableDate(204, "Time when the order item was last changed."),
  label: Schema.String.pipe(field(205, "Display label for the order item.")),
  amount: Schema.Int.pipe(field(206, "Order item amount in the smallest currency unit.")),
  tax_amount: Schema.Int.pipe(field(207, "Tax amount in the smallest currency unit.")),
  proration: Schema.Boolean.pipe(field(208, "Whether the item is a proration.")),
  product_price_id: Schema.NullOr(Schema.String).pipe(
    field(209, "Product price linked to the item."),
  ),
});

export const makeListResponseSchema = <A>(
  item: Schema.Decoder<A>,
): Schema.Decoder<ListResponse<A>> =>
  Schema.Struct({
    items: Schema.Array(item),
    pagination: Schema.Struct({
      total_count: Schema.Int,
      max_page: Schema.Int,
    }),
  });

export const ListResponseSchema = makeListResponseSchema(Schema.Any);

export type ListResponse<T = unknown> = {
  readonly items: ReadonlyArray<T>;
  readonly pagination: {
    readonly total_count: number;
    readonly max_page: number;
  };
};

export type Address = Schema.Schema.Type<typeof AddressSchema>;

export type OrderItem = Schema.Schema.Type<typeof OrderItemSchema>;
