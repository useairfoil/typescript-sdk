import * as Schema from "effect/Schema";

import {
  AddressFields,
  DiscountAllocationFields,
  GraphQLAddressSchema,
  GraphQLAttributeSchema,
  GraphQLDiscountAllocationSchema,
  GraphQLMoneyBagSchema,
  GraphQLTaxLineSchema,
  MoneyBagFields,
  type Nodes,
  PageInfoFields,
  TaxLineFields,
  connection,
  emptyText,
  fromGraphQL,
  idRef,
  normalizeAmount,
  pageQuery,
} from "../shared";
import {
  DiscountAllocationMethodSchema,
  type DiscountApplication,
  DiscountTargetSelectionSchema,
  DiscountTargetTypeSchema,
  type Order,
  OrderCancelReasonSchema,
  OrderFinancialStatusSchema,
} from "./row";

const LineItemFields = `
  id
  name
  title
  variantTitle
  sku
  vendor
  product { id }
  variant { id }
  quantity
  currentQuantity
  taxable
  requiresShipping
  isGiftCard
  originalUnitPriceSet { ${MoneyBagFields} }
  totalDiscountSet { ${MoneyBagFields} }
  taxLines { ${TaxLineFields} }
  discountAllocations { ${DiscountAllocationFields} }
  customAttributes { key value }
`;

const ShippingLineFields = `
  id
  title
  code
  source
  carrierIdentifier
  phone
  isRemoved
  originalPriceSet { ${MoneyBagFields} }
  discountedPriceSet { ${MoneyBagFields} }
  currentDiscountedPriceSet { ${MoneyBagFields} }
  taxLines { ${TaxLineFields} }
  discountAllocations { ${DiscountAllocationFields} }
`;

const DiscountApplicationFields = `
  __typename
  index
  allocationMethod
  targetSelection
  targetType
  value {
    __typename
    ... on MoneyV2 { amount }
    ... on PricingPercentageValue { percentage }
  }
  ... on DiscountCodeApplication { code }
  ... on ManualDiscountApplication { title description }
  ... on AutomaticDiscountApplication { title }
  ... on ScriptDiscountApplication { title }
`;

export const OrderFields = `
  id
  legacyResourceId
  name
  email
  phone
  customer { id }
  customerLocale
  customerAcceptsMarketing
  billingAddress { ${AddressFields} }
  shippingAddress { ${AddressFields} }
  note
  customAttributes { key value }
  tags
  confirmationNumber
  poNumber
  sourceName
  sourceIdentifier
  app { id }
  paymentGatewayNames
  test
  taxesIncluded
  taxExempt
  dutiesIncluded
  estimatedTaxes
  totalWeight
  displayFinancialStatus
  cancelReason
  cancelledAt
  closedAt
  processedAt
  createdAt
  updatedAt
  currencyCode
  presentmentCurrencyCode
  discountCodes
  discountApplications(first: 25) { nodes { ${DiscountApplicationFields} } ${PageInfoFields} }
  subtotalPriceSet { ${MoneyBagFields} }
  currentSubtotalPriceSet { ${MoneyBagFields} }
  totalDiscountsSet { ${MoneyBagFields} }
  currentTotalDiscountsSet { ${MoneyBagFields} }
  totalShippingPriceSet { ${MoneyBagFields} }
  currentShippingPriceSet { ${MoneyBagFields} }
  totalTaxSet { ${MoneyBagFields} }
  currentTotalTaxSet { ${MoneyBagFields} }
  originalTotalDutiesSet { ${MoneyBagFields} }
  currentTotalDutiesSet { ${MoneyBagFields} }
  totalPriceSet { ${MoneyBagFields} }
  currentTotalPriceSet { ${MoneyBagFields} }
  taxLines { ${TaxLineFields} }
  shippingLines(first: 25, includeRemovals: true) { nodes { ${ShippingLineFields} } ${PageInfoFields} }
  lineItems(first: 50) { nodes { ${LineItemFields} } ${PageInfoFields} }
`;

const orderConnectionQuery = (name: string, selection: string) => `#graphql
query ${name}($id: ID!, $first: Int!, $after: String) {
  node: order(id: $id) {
    connection: ${selection}
  }
}
`;

export const OrderLineItemsQuery = orderConnectionQuery(
  "AirfoilOrderLineItems",
  `lineItems(first: $first, after: $after) { nodes { ${LineItemFields} } ${PageInfoFields} }`,
);

export const OrderShippingLinesQuery = orderConnectionQuery(
  "AirfoilOrderShippingLines",
  `shippingLines(first: $first, after: $after, includeRemovals: true) { nodes { ${ShippingLineFields} } ${PageInfoFields} }`,
);

export const OrderDiscountApplicationsQuery = orderConnectionQuery(
  "AirfoilOrderDiscountApplications",
  `discountApplications(first: $first, after: $after) { nodes { ${DiscountApplicationFields} } ${PageInfoFields} }`,
);

export const GraphQLLineItemsSchema = connection(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    title: Schema.String,
    variantTitle: Schema.NullOr(Schema.String),
    sku: Schema.NullOr(Schema.String),
    vendor: Schema.NullOr(Schema.String),
    product: idRef,
    variant: idRef,
    quantity: Schema.Int,
    currentQuantity: Schema.Int,
    taxable: Schema.Boolean,
    requiresShipping: Schema.Boolean,
    isGiftCard: Schema.Boolean,
    originalUnitPriceSet: GraphQLMoneyBagSchema,
    totalDiscountSet: GraphQLMoneyBagSchema,
    taxLines: Schema.Array(GraphQLTaxLineSchema),
    discountAllocations: Schema.Array(GraphQLDiscountAllocationSchema),
    customAttributes: Schema.Array(GraphQLAttributeSchema),
  }),
);

export const GraphQLShippingLinesSchema = connection(
  Schema.Struct({
    id: Schema.NullOr(Schema.String),
    title: Schema.String,
    code: Schema.NullOr(Schema.String),
    source: Schema.NullOr(Schema.String),
    carrierIdentifier: Schema.NullOr(Schema.String),
    phone: Schema.NullOr(Schema.String),
    isRemoved: Schema.Boolean,
    originalPriceSet: GraphQLMoneyBagSchema,
    discountedPriceSet: GraphQLMoneyBagSchema,
    currentDiscountedPriceSet: GraphQLMoneyBagSchema,
    taxLines: Schema.Array(GraphQLTaxLineSchema),
    discountAllocations: Schema.Array(GraphQLDiscountAllocationSchema),
  }),
);

const discountApplicationBase = {
  index: Schema.Int,
  allocationMethod: DiscountAllocationMethodSchema,
  targetSelection: DiscountTargetSelectionSchema,
  targetType: DiscountTargetTypeSchema,
  value: Schema.Union([
    Schema.Struct({ __typename: Schema.Literal("MoneyV2"), amount: Schema.String }),
    Schema.Struct({
      __typename: Schema.Literal("PricingPercentageValue"),
      percentage: Schema.Number,
    }),
  ]),
};

export const GraphQLDiscountApplicationsSchema = connection(
  Schema.Union([
    Schema.Struct({
      __typename: Schema.Literal("DiscountCodeApplication"),
      code: Schema.String,
      ...discountApplicationBase,
    }),
    Schema.Struct({
      __typename: Schema.Literal("ManualDiscountApplication"),
      title: Schema.String,
      description: Schema.NullOr(Schema.String),
      ...discountApplicationBase,
    }),
    Schema.Struct({
      __typename: Schema.Literals(["AutomaticDiscountApplication", "ScriptDiscountApplication"]),
      title: Schema.String,
      ...discountApplicationBase,
    }),
  ]),
);

export const GraphQLOrderNodeSchema = Schema.Struct({
  id: Schema.String,
  legacyResourceId: Schema.Union([Schema.String, Schema.Number]),
  name: Schema.String,
  email: Schema.NullOr(Schema.String),
  phone: Schema.NullOr(Schema.String),
  customer: idRef,
  customerLocale: Schema.NullOr(Schema.String),
  customerAcceptsMarketing: Schema.Boolean,
  billingAddress: Schema.NullOr(GraphQLAddressSchema),
  shippingAddress: Schema.NullOr(GraphQLAddressSchema),
  note: Schema.NullOr(Schema.String),
  customAttributes: Schema.Array(GraphQLAttributeSchema),
  tags: Schema.Array(Schema.String),
  confirmationNumber: Schema.NullOr(Schema.String),
  poNumber: Schema.NullOr(Schema.String),
  sourceName: Schema.NullOr(Schema.String),
  sourceIdentifier: Schema.NullOr(Schema.String),
  app: idRef,
  paymentGatewayNames: Schema.Array(Schema.String),
  test: Schema.Boolean,
  taxesIncluded: Schema.Boolean,
  taxExempt: Schema.Boolean,
  dutiesIncluded: Schema.Boolean,
  estimatedTaxes: Schema.Boolean,
  totalWeight: Schema.NullOr(Schema.NumberFromString),
  displayFinancialStatus: Schema.NullOr(OrderFinancialStatusSchema),
  cancelReason: Schema.NullOr(OrderCancelReasonSchema),
  cancelledAt: Schema.NullOr(Schema.DateFromString),
  closedAt: Schema.NullOr(Schema.DateFromString),
  processedAt: Schema.DateFromString,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
  currencyCode: Schema.String,
  presentmentCurrencyCode: Schema.String,
  discountCodes: Schema.Array(Schema.String),
  discountApplications: GraphQLDiscountApplicationsSchema,
  subtotalPriceSet: Schema.NullOr(GraphQLMoneyBagSchema),
  currentSubtotalPriceSet: GraphQLMoneyBagSchema,
  totalDiscountsSet: Schema.NullOr(GraphQLMoneyBagSchema),
  currentTotalDiscountsSet: GraphQLMoneyBagSchema,
  totalShippingPriceSet: GraphQLMoneyBagSchema,
  currentShippingPriceSet: GraphQLMoneyBagSchema,
  totalTaxSet: Schema.NullOr(GraphQLMoneyBagSchema),
  currentTotalTaxSet: GraphQLMoneyBagSchema,
  originalTotalDutiesSet: Schema.NullOr(GraphQLMoneyBagSchema),
  currentTotalDutiesSet: Schema.NullOr(GraphQLMoneyBagSchema),
  totalPriceSet: GraphQLMoneyBagSchema,
  currentTotalPriceSet: GraphQLMoneyBagSchema,
  taxLines: Schema.Array(GraphQLTaxLineSchema),
  shippingLines: GraphQLShippingLinesSchema,
  lineItems: GraphQLLineItemsSchema,
});

export type GraphQLOrderNode = Schema.Schema.Type<typeof GraphQLOrderNodeSchema>;

export const fromOrderNode = (
  node: GraphQLOrderNode,
  nested: {
    readonly discountApplications: Nodes<typeof GraphQLDiscountApplicationsSchema>;
    readonly shippingLines: Nodes<typeof GraphQLShippingLinesSchema>;
    readonly lineItems: Nodes<typeof GraphQLLineItemsSchema>;
  },
): Order => ({
  id: node.id,
  legacyResourceId: String(node.legacyResourceId),
  name: node.name,
  email: emptyText(node.email),
  phone: emptyText(node.phone),
  customerId: node.customer?.id ?? "",
  customerLocale: emptyText(node.customerLocale),
  customerAcceptsMarketing: node.customerAcceptsMarketing,
  billingAddress: node.billingAddress ? fromGraphQL.address(node.billingAddress) : null,
  shippingAddress: node.shippingAddress ? fromGraphQL.address(node.shippingAddress) : null,
  note: emptyText(node.note),
  customAttributes: node.customAttributes,
  tags: node.tags,
  confirmationNumber: emptyText(node.confirmationNumber),
  poNumber: emptyText(node.poNumber),
  sourceName: emptyText(node.sourceName),
  sourceIdentifier: emptyText(node.sourceIdentifier),
  appId: node.app?.id ?? "",
  paymentGatewayNames: node.paymentGatewayNames,
  test: node.test,
  taxesIncluded: node.taxesIncluded,
  taxExempt: node.taxExempt,
  dutiesIncluded: node.dutiesIncluded,
  estimatedTaxes: node.estimatedTaxes,
  totalWeight: node.totalWeight,
  displayFinancialStatus: node.displayFinancialStatus,
  cancelReason: node.cancelReason,
  cancelledAt: node.cancelledAt,
  closedAt: node.closedAt,
  processedAt: node.processedAt,
  createdAt: node.createdAt,
  updatedAt: node.updatedAt,
  currencyCode: node.currencyCode,
  presentmentCurrencyCode: node.presentmentCurrencyCode,
  discountCodes: node.discountCodes,
  discountApplications: nested.discountApplications.map(
    (application): DiscountApplication => ({
      index: application.index,
      type:
        application.__typename === "DiscountCodeApplication"
          ? "DISCOUNT_CODE"
          : application.__typename === "ManualDiscountApplication"
            ? "MANUAL"
            : application.__typename === "AutomaticDiscountApplication"
              ? "AUTOMATIC"
              : "SCRIPT",
      code: application.__typename === "DiscountCodeApplication" ? application.code : null,
      title: application.__typename === "DiscountCodeApplication" ? null : application.title,
      description:
        application.__typename === "ManualDiscountApplication" ? application.description : null,
      allocationMethod: application.allocationMethod,
      targetSelection: application.targetSelection,
      targetType: application.targetType,
      valueType: application.value.__typename === "MoneyV2" ? "FIXED_AMOUNT" : "PERCENTAGE",
      value:
        application.value.__typename === "MoneyV2"
          ? normalizeAmount(application.value.amount)
          : normalizeAmount(String(application.value.percentage)),
    }),
  ),
  subtotalPriceSet: node.subtotalPriceSet ? fromGraphQL.money(node.subtotalPriceSet) : null,
  currentSubtotalPriceSet: fromGraphQL.money(node.currentSubtotalPriceSet),
  totalDiscountsSet: node.totalDiscountsSet ? fromGraphQL.money(node.totalDiscountsSet) : null,
  currentTotalDiscountsSet: fromGraphQL.money(node.currentTotalDiscountsSet),
  totalShippingPriceSet: fromGraphQL.money(node.totalShippingPriceSet),
  currentShippingPriceSet: fromGraphQL.money(node.currentShippingPriceSet),
  totalTaxSet: node.totalTaxSet ? fromGraphQL.money(node.totalTaxSet) : null,
  currentTotalTaxSet: fromGraphQL.money(node.currentTotalTaxSet),
  originalTotalDutiesSet: node.originalTotalDutiesSet
    ? fromGraphQL.money(node.originalTotalDutiesSet)
    : null,
  currentTotalDutiesSet: node.currentTotalDutiesSet
    ? fromGraphQL.money(node.currentTotalDutiesSet)
    : null,
  totalPriceSet: fromGraphQL.money(node.totalPriceSet),
  currentTotalPriceSet: fromGraphQL.money(node.currentTotalPriceSet),
  taxLines: node.taxLines.map(fromGraphQL.taxLine),
  shippingLines: nested.shippingLines.map((line) => ({
    id: line.id,
    title: line.title,
    code: line.code,
    source: line.source,
    carrierIdentifier: line.carrierIdentifier,
    phone: line.phone,
    isRemoved: line.isRemoved,
    originalPriceSet: fromGraphQL.money(line.originalPriceSet),
    discountedPriceSet: fromGraphQL.money(line.discountedPriceSet),
    currentDiscountedPriceSet: fromGraphQL.money(line.currentDiscountedPriceSet),
    taxLines: line.taxLines.map(fromGraphQL.taxLine),
    discountAllocations: line.discountAllocations.map(fromGraphQL.discountAllocation),
  })),
  lineItems: nested.lineItems.map((item) => ({
    id: item.id,
    name: item.name,
    title: item.title,
    variantTitle: item.variantTitle,
    sku: item.sku,
    vendor: item.vendor,
    productId: item.product?.id ?? null,
    variantId: item.variant?.id ?? null,
    quantity: item.quantity,
    currentQuantity: item.currentQuantity,
    taxable: item.taxable,
    requiresShipping: item.requiresShipping,
    isGiftCard: item.isGiftCard,
    originalUnitPriceSet: fromGraphQL.money(item.originalUnitPriceSet),
    totalDiscountSet: fromGraphQL.money(item.totalDiscountSet),
    taxLines: item.taxLines.map(fromGraphQL.taxLine),
    discountAllocations: item.discountAllocations.map(fromGraphQL.discountAllocation),
    customAttributes: item.customAttributes,
  })),
});

export const OrdersQuery = pageQuery("AirfoilOrders", "orders", OrderFields);

export const GraphQLOrdersDataSchema = Schema.Struct({
  orders: connection(GraphQLOrderNodeSchema),
});
