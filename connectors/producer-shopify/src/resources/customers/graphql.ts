import * as Schema from "effect/Schema";

import {
  AddressWithoutCoordinatesFields,
  GraphQLAddressWithoutCoordinatesSchema,
  connection,
  emptyText,
  fromGraphQL,
  normalizeAmount,
  pageQuery,
} from "../shared";
import {
  ConsentCollectedFromSchema,
  type Customer,
  CustomerStateSchema,
  EmailMarketingStateSchema,
  MarketingOptInLevelSchema,
  ProductSubscriberStatusSchema,
  SmsMarketingStateSchema,
} from "./row";

// Customer webhooks have no coordinates, so customer addresses leave them out.
const CustomerAddressNodeFields = `id ${AddressWithoutCoordinatesFields}`;

export const CustomerFields = `
  id
  legacyResourceId
  firstName
  lastName
  displayName
  note
  state
  verifiedEmail
  taxExempt
  taxExemptions
  tags
  locale
  numberOfOrders
  amountSpent { amount currencyCode }
  lastOrder { id }
  productSubscriberStatus
  dataSaleOptOut
  defaultEmailAddress { emailAddress marketingState marketingOptInLevel marketingUpdatedAt }
  defaultPhoneNumber { phoneNumber }
  smsMarketingConsent { marketingState marketingOptInLevel consentUpdatedAt consentCollectedFrom }
  defaultAddress { id }
  addressesV2(first: 25) {
    nodes { ${CustomerAddressNodeFields} }
    pageInfo { hasNextPage endCursor }
  }
  createdAt
  updatedAt
`;

export const CustomerAddressesQuery = `#graphql
query AirfoilCustomerAddresses($id: ID!, $first: Int!, $after: String) {
  node: customer(id: $id) {
    connection: addressesV2(first: $first, after: $after) {
      nodes { ${CustomerAddressNodeFields} }
      pageInfo { hasNextPage endCursor }
    }
  }
}
`;

export const CustomerTagsQuery = `#graphql
query AirfoilCustomerTags($id: ID!) {
  customer(id: $id) { tags }
}
`;

const GraphQLCustomerAddressSchema = Schema.Struct({
  id: Schema.String,
  ...GraphQLAddressWithoutCoordinatesSchema.fields,
});

export const GraphQLCustomerAddressesSchema = connection(GraphQLCustomerAddressSchema);

export const GraphQLCustomerTagsSchema = Schema.Struct({
  customer: Schema.NullOr(Schema.Struct({ tags: Schema.Array(Schema.String) })),
});

export const GraphQLCustomerNodeSchema = Schema.Struct({
  id: Schema.String,
  legacyResourceId: Schema.Union([Schema.String, Schema.Number]),
  firstName: Schema.NullOr(Schema.String),
  lastName: Schema.NullOr(Schema.String),
  displayName: Schema.String,
  note: Schema.NullOr(Schema.String),
  state: CustomerStateSchema,
  verifiedEmail: Schema.Boolean,
  taxExempt: Schema.Boolean,
  taxExemptions: Schema.Array(Schema.String),
  tags: Schema.Array(Schema.String),
  locale: Schema.String,
  numberOfOrders: Schema.NumberFromString,
  amountSpent: Schema.Struct({ amount: Schema.String, currencyCode: Schema.String }),
  lastOrder: Schema.NullOr(Schema.Struct({ id: Schema.String })),
  productSubscriberStatus: ProductSubscriberStatusSchema,
  dataSaleOptOut: Schema.Boolean,
  defaultEmailAddress: Schema.NullOr(
    Schema.Struct({
      emailAddress: Schema.String,
      marketingState: EmailMarketingStateSchema,
      marketingOptInLevel: Schema.NullOr(MarketingOptInLevelSchema),
      marketingUpdatedAt: Schema.NullOr(Schema.DateFromString),
    }),
  ),
  defaultPhoneNumber: Schema.NullOr(Schema.Struct({ phoneNumber: Schema.String })),
  smsMarketingConsent: Schema.NullOr(
    Schema.Struct({
      marketingState: SmsMarketingStateSchema,
      marketingOptInLevel: MarketingOptInLevelSchema,
      consentUpdatedAt: Schema.NullOr(Schema.DateFromString),
      consentCollectedFrom: Schema.NullOr(ConsentCollectedFromSchema),
    }),
  ),
  defaultAddress: Schema.NullOr(Schema.Struct({ id: Schema.String })),
  addressesV2: GraphQLCustomerAddressesSchema,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
});

export type GraphQLCustomerNode = Schema.Schema.Type<typeof GraphQLCustomerNodeSchema>;

export type GraphQLCustomerAddress = Schema.Schema.Type<typeof GraphQLCustomerAddressSchema>;

const addressId = (value: string): string => value.replace(/\?.*$/, "");

export const normalizeCustomerNode = (
  node: GraphQLCustomerNode,
  addresses: ReadonlyArray<GraphQLCustomerAddress>,
): Customer => ({
  id: node.id,
  legacyResourceId: String(node.legacyResourceId),
  firstName: emptyText(node.firstName),
  lastName: emptyText(node.lastName),
  displayName: node.displayName,
  email: node.defaultEmailAddress?.emailAddress ?? "",
  emailMarketingState: node.defaultEmailAddress?.marketingState ?? null,
  emailMarketingOptInLevel: node.defaultEmailAddress?.marketingOptInLevel ?? null,
  emailMarketingUpdatedAt: node.defaultEmailAddress?.marketingUpdatedAt ?? null,
  phone: node.defaultPhoneNumber?.phoneNumber ?? "",
  smsMarketingState: node.smsMarketingConsent?.marketingState ?? null,
  smsMarketingOptInLevel: node.smsMarketingConsent?.marketingOptInLevel ?? null,
  smsMarketingUpdatedAt: node.smsMarketingConsent?.consentUpdatedAt ?? null,
  smsMarketingCollectedFrom: node.smsMarketingConsent?.consentCollectedFrom ?? null,
  note: emptyText(node.note),
  state: node.state,
  verifiedEmail: node.verifiedEmail,
  taxExempt: node.taxExempt,
  taxExemptions: node.taxExemptions,
  tags: node.tags,
  locale: node.locale,
  numberOfOrders: node.numberOfOrders,
  amountSpent: {
    amount: normalizeAmount(node.amountSpent.amount),
    currencyCode: node.amountSpent.currencyCode,
  },
  lastOrderId: node.lastOrder?.id ?? "",
  productSubscriberStatus: node.productSubscriberStatus,
  dataSaleOptOut: node.dataSaleOptOut,
  defaultAddressId: node.defaultAddress === null ? "" : addressId(node.defaultAddress.id),
  addresses: addresses.map(({ id, ...value }) => ({
    id: addressId(id),
    ...fromGraphQL.addressWithoutCoordinates(value),
  })),
  createdAt: node.createdAt,
  updatedAt: node.updatedAt,
});

export const CustomersQuery = pageQuery("AirfoilCustomers", "customers", CustomerFields);

export const GraphQLCustomersDataSchema = Schema.Struct({
  customers: connection(GraphQLCustomerNodeSchema),
});
