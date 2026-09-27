import { Iceberg } from "@useairfoil/connector-kit";
import { SchemaTransformation } from "effect";
import * as Schema from "effect/Schema";

export const field = (fieldId: number, description: string) =>
  Iceberg.field(fieldId, { description });

export const PageInfoSchema = Schema.Struct({
  hasNextPage: Schema.Boolean,
  endCursor: Schema.NullOr(Schema.String),
});

export const gid = (type: string, id: number | string): string => `gid://shopify/${type}/${id}`;

export const normalizeAmount = (amount: string): string =>
  amount.includes(".") ? amount.replace(/0+$/, "").replace(/\.$/, "") : amount;

export const emptyText = (value: string | null): string => value ?? "";

export const splitTags = (value: string): ReadonlyArray<string> =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

// Each row helper takes the first field ID of its block.

export const moneyBag = (baseId: number) =>
  Schema.Struct({
    shopMoney: Schema.Struct({
      amount: Schema.String.pipe(field(baseId + 3, "Amount in the shop currency.")),
      currencyCode: Schema.String.pipe(field(baseId + 4, "Shop currency code.")),
    }).pipe(field(baseId + 1, "Amount in the shop currency.")),
    presentmentMoney: Schema.Struct({
      amount: Schema.String.pipe(field(baseId + 5, "Amount in the customer currency.")),
      currencyCode: Schema.String.pipe(field(baseId + 6, "Customer currency code.")),
    }).pipe(field(baseId + 2, "Amount in the customer currency.")),
  });

export const addressFields = (baseId: number) => ({
  firstName: Schema.NullOr(Schema.String).pipe(field(baseId + 1, "First name.")),
  lastName: Schema.NullOr(Schema.String).pipe(field(baseId + 2, "Last name.")),
  name: Schema.NullOr(Schema.String).pipe(field(baseId + 3, "Full name.")),
  company: Schema.NullOr(Schema.String).pipe(field(baseId + 4, "Company name.")),
  address1: Schema.NullOr(Schema.String).pipe(field(baseId + 5, "First address line.")),
  address2: Schema.NullOr(Schema.String).pipe(field(baseId + 6, "Second address line.")),
  city: Schema.NullOr(Schema.String).pipe(field(baseId + 7, "City.")),
  province: Schema.NullOr(Schema.String).pipe(field(baseId + 8, "Province or state.")),
  provinceCode: Schema.NullOr(Schema.String).pipe(field(baseId + 9, "Province or state code.")),
  country: Schema.NullOr(Schema.String).pipe(field(baseId + 10, "Country.")),
  countryCode: Schema.NullOr(Schema.String).pipe(field(baseId + 11, "Two-letter country code.")),
  zip: Schema.NullOr(Schema.String).pipe(field(baseId + 12, "Postal code.")),
  phone: Schema.NullOr(Schema.String).pipe(field(baseId + 13, "Phone number.")),
});

export const address = (baseId: number) =>
  Schema.Struct({
    ...addressFields(baseId),
    latitude: Schema.NullOr(Schema.Finite).pipe(field(baseId + 14, "Latitude.")),
    longitude: Schema.NullOr(Schema.Finite).pipe(field(baseId + 15, "Longitude.")),
  });

export const attributes = (baseId: number) =>
  Schema.Array(
    Schema.Struct({
      key: Schema.String.pipe(field(baseId + 2, "Attribute name.")),
      value: Schema.NullOr(Schema.String).pipe(field(baseId + 3, "Attribute value.")),
    }).annotate({ fieldId: baseId + 1 }),
  );

export const taxLines = (baseId: number) =>
  Schema.Array(
    Schema.Struct({
      title: Schema.String.pipe(field(baseId + 2, "Tax name.")),
      rate: Schema.NullOr(Schema.Finite).pipe(field(baseId + 3, "Tax rate as a fraction.")),
      priceSet: moneyBag(baseId + 10).pipe(field(baseId + 4, "Tax amount.")),
    }).annotate({ fieldId: baseId + 1 }),
  );

export const discountAllocations = (baseId: number) =>
  Schema.Array(
    Schema.Struct({
      discountApplicationIndex: Schema.Int.pipe(
        field(baseId + 2, "Index of the order discount application."),
      ),
      amountSet: moneyBag(baseId + 10).pipe(field(baseId + 3, "Allocated discount amount.")),
    }).annotate({ fieldId: baseId + 1 }),
  );

export type MoneyBag = Schema.Schema.Type<ReturnType<typeof moneyBag>>;

export type Address = Schema.Schema.Type<ReturnType<typeof address>>;

export type AddressWithoutCoordinates = Omit<Address, "latitude" | "longitude">;

export type Attribute = Schema.Schema.Type<ReturnType<typeof attributes>>[number];

export type TaxLine = Schema.Schema.Type<ReturnType<typeof taxLines>>[number];

export type DiscountAllocation = Schema.Schema.Type<ReturnType<typeof discountAllocations>>[number];

export const RestMoneyBagSchema = Schema.Struct({
  shop_money: Schema.Struct({ amount: Schema.String, currency_code: Schema.String }),
  presentment_money: Schema.Struct({ amount: Schema.String, currency_code: Schema.String }),
});

const optionalText = Schema.optional(Schema.NullOr(Schema.String));

const optionalNumber = Schema.optional(Schema.NullOr(Schema.Number));

export const RestAddressSchema = Schema.Struct({
  first_name: optionalText,
  last_name: optionalText,
  name: optionalText,
  company: optionalText,
  address1: optionalText,
  address2: optionalText,
  city: optionalText,
  province: optionalText,
  province_code: optionalText,
  country: optionalText,
  country_code: optionalText,
  zip: optionalText,
  phone: optionalText,
  latitude: optionalNumber,
  longitude: optionalNumber,
});

export const RestAttributeSchema = Schema.Struct({
  name: Schema.String,
  value: Schema.NullOr(Schema.String),
});

export const RestTaxLineSchema = Schema.Struct({
  title: Schema.String,
  rate: Schema.NullOr(Schema.Number),
  price_set: RestMoneyBagSchema,
});

export const RestDiscountAllocationSchema = Schema.Struct({
  discount_application_index: Schema.Int,
  amount_set: RestMoneyBagSchema,
});

type RestMoneyBag = Schema.Schema.Type<typeof RestMoneyBagSchema>;

type RestAddress = Schema.Schema.Type<typeof RestAddressSchema>;

type RestAddressWithoutCoordinates = Omit<RestAddress, "latitude" | "longitude">;

export const fromRest = {
  money: (bag: RestMoneyBag): MoneyBag => ({
    shopMoney: {
      amount: normalizeAmount(bag.shop_money.amount),
      currencyCode: bag.shop_money.currency_code,
    },
    presentmentMoney: {
      amount: normalizeAmount(bag.presentment_money.amount),
      currencyCode: bag.presentment_money.currency_code,
    },
  }),
  address: ({ latitude, longitude, ...value }: RestAddress): Address => ({
    ...fromRest.addressWithoutCoordinates(value),
    latitude: latitude ?? null,
    longitude: longitude ?? null,
  }),
  addressWithoutCoordinates: (value: RestAddressWithoutCoordinates): AddressWithoutCoordinates => ({
    firstName: value.first_name ?? null,
    lastName: value.last_name ?? null,
    name: value.name ?? null,
    company: value.company ?? null,
    address1: value.address1 ?? null,
    address2: value.address2 ?? null,
    city: value.city ?? null,
    province: value.province ?? null,
    provinceCode: value.province_code ?? null,
    country: value.country ?? null,
    countryCode: value.country_code ?? null,
    zip: value.zip ?? null,
    phone: value.phone ?? null,
  }),
  attribute: (value: Schema.Schema.Type<typeof RestAttributeSchema>): Attribute => ({
    key: value.name,
    value: value.value,
  }),
  taxLine: (value: Schema.Schema.Type<typeof RestTaxLineSchema>): TaxLine => ({
    title: value.title,
    rate: value.rate,
    priceSet: fromRest.money(value.price_set),
  }),
  discountAllocation: (
    value: Schema.Schema.Type<typeof RestDiscountAllocationSchema>,
  ): DiscountAllocation => ({
    discountApplicationIndex: value.discount_application_index,
    amountSet: fromRest.money(value.amount_set),
  }),
};

export const MoneyBagFields = `shopMoney { amount currencyCode } presentmentMoney { amount currencyCode }`;

export const AddressWithoutCoordinatesFields = `firstName lastName name company address1 address2 city province provinceCode country countryCodeV2 zip phone`;

export const AddressFields = `${AddressWithoutCoordinatesFields} latitude longitude`;

export const TaxLineFields = `title rate priceSet { ${MoneyBagFields} }`;

export const DiscountAllocationFields = `allocatedAmountSet { ${MoneyBagFields} } discountApplication { index }`;

export const GraphQLMoneyBagSchema = Schema.Struct({
  shopMoney: Schema.Struct({ amount: Schema.String, currencyCode: Schema.String }),
  presentmentMoney: Schema.Struct({ amount: Schema.String, currencyCode: Schema.String }),
});

export const GraphQLAddressWithoutCoordinatesSchema = Schema.Struct({
  firstName: Schema.NullOr(Schema.String),
  lastName: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  company: Schema.NullOr(Schema.String),
  address1: Schema.NullOr(Schema.String),
  address2: Schema.NullOr(Schema.String),
  city: Schema.NullOr(Schema.String),
  province: Schema.NullOr(Schema.String),
  provinceCode: Schema.NullOr(Schema.String),
  country: Schema.NullOr(Schema.String),
  countryCodeV2: Schema.NullOr(Schema.String),
  zip: Schema.NullOr(Schema.String),
  phone: Schema.NullOr(Schema.String),
});

export const GraphQLAddressSchema = Schema.Struct({
  ...GraphQLAddressWithoutCoordinatesSchema.fields,
  latitude: Schema.NullOr(Schema.Number),
  longitude: Schema.NullOr(Schema.Number),
});

export const GraphQLAttributeSchema = Schema.Struct({
  key: Schema.String,
  value: Schema.NullOr(Schema.String),
});

export const GraphQLTaxLineSchema = Schema.Struct({
  title: Schema.String,
  rate: Schema.NullOr(Schema.Number),
  priceSet: GraphQLMoneyBagSchema,
});

export const GraphQLDiscountAllocationSchema = Schema.Struct({
  allocatedAmountSet: GraphQLMoneyBagSchema,
  discountApplication: Schema.Struct({ index: Schema.Int }),
});

export const connection = <S extends Schema.Top>(node: S) =>
  Schema.Struct({ nodes: Schema.Array(node), pageInfo: PageInfoSchema });

type GraphQLMoneyBag = Schema.Schema.Type<typeof GraphQLMoneyBagSchema>;

type GraphQLAddress = Schema.Schema.Type<typeof GraphQLAddressSchema>;

type GraphQLAddressWithoutCoordinates = Schema.Schema.Type<
  typeof GraphQLAddressWithoutCoordinatesSchema
>;

export const fromGraphQL = {
  money: (bag: GraphQLMoneyBag): MoneyBag => ({
    shopMoney: {
      amount: normalizeAmount(bag.shopMoney.amount),
      currencyCode: bag.shopMoney.currencyCode,
    },
    presentmentMoney: {
      amount: normalizeAmount(bag.presentmentMoney.amount),
      currencyCode: bag.presentmentMoney.currencyCode,
    },
  }),
  address: ({ latitude, longitude, ...value }: GraphQLAddress): Address => ({
    ...fromGraphQL.addressWithoutCoordinates(value),
    latitude,
    longitude,
  }),
  addressWithoutCoordinates: ({
    countryCodeV2,
    ...value
  }: GraphQLAddressWithoutCoordinates): AddressWithoutCoordinates => ({
    ...value,
    countryCode: countryCodeV2,
  }),
  taxLine: (value: Schema.Schema.Type<typeof GraphQLTaxLineSchema>): TaxLine => ({
    title: value.title,
    rate: value.rate,
    priceSet: fromGraphQL.money(value.priceSet),
  }),
  discountAllocation: (
    value: Schema.Schema.Type<typeof GraphQLDiscountAllocationSchema>,
  ): DiscountAllocation => ({
    discountApplicationIndex: value.discountApplication.index,
    amountSet: fromGraphQL.money(value.allocatedAmountSet),
  }),
};

// Webhooks send enum values in lower case.
export const upper = <const L extends ReadonlyArray<string>>(literals: Schema.Literals<L>) =>
  Schema.String.pipe(Schema.decode(SchemaTransformation.toUpperCase()), Schema.decodeTo(literals));

export const PageInfoFields = `pageInfo { hasNextPage endCursor }`;

export const idRef = Schema.NullOr(Schema.Struct({ id: Schema.String }));

export type Nodes<S extends Schema.Top> =
  Schema.Schema.Type<S> extends { readonly nodes: infer N } ? N : never;

export const pageQuery = (name: string, connection: string, fields: string) => `#graphql
query ${name}($first: Int!, $after: String) {
  ${connection}(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
    nodes {
      ${fields}
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

export type PageInfo = Schema.Schema.Type<typeof PageInfoSchema>;
