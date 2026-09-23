import { Iceberg } from "@useairfoil/connector-kit";
import * as Schema from "effect/Schema";

const field = (fieldId: number, description: string) => Iceberg.field(fieldId, { description });

const JsonStringSchema = Schema.flip(Schema.fromJsonString(Schema.Unknown));

export const PageInfoSchema = Schema.Struct({
  hasNextPage: Schema.Boolean,
  endCursor: Schema.NullOr(Schema.String),
});

export const ProductStatusSchema = Schema.Literals(["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"]);
export const RestProductStatusSchema = Schema.Literals(["active", "archived", "draft"]);
export const ProductVariantInventoryPolicySchema = Schema.Literals(["CONTINUE", "DENY"]);
export const RestProductVariantInventoryPolicySchema = Schema.Literals(["continue", "deny"]);

const ProductImageSchema = Schema.Struct({
  url: Schema.String.pipe(field(202, "URL of the image.")),
  altText: Schema.NullOr(Schema.String).pipe(field(203, "Alternative text for the image.")),
});

export const ProductFeaturedMediaSchema = Schema.Struct({
  image: Schema.NullOr(ProductImageSchema).pipe(field(201, "Image for the featured media.")),
});

export const ProductOptionSchema = Schema.Struct({
  id: Schema.String.pipe(field(302, "Unique product option identifier.")),
  name: Schema.String.pipe(field(303, "Name of the product option.")),
  position: Schema.Int.pipe(field(304, "Position of the option on the product.")),
  values: Schema.Array(Schema.String.annotate({ fieldId: 306 })).pipe(
    field(305, "Values available for the option."),
  ),
});

export const ProductVariantSchema = Schema.Struct({
  id: Schema.String.pipe(field(402, "Unique product variant identifier.")),
  legacyResourceId: Schema.String.pipe(field(403, "Numeric variant identifier stored as text.")),
  title: Schema.String.pipe(field(404, "Display title of the variant.")),
  sku: Schema.NullOr(Schema.String).pipe(field(405, "Stock keeping unit for the variant.")),
  barcode: Schema.NullOr(Schema.String).pipe(field(406, "Barcode for the variant.")),
  price: Schema.String.pipe(field(407, "Price of the variant.")),
  compareAtPrice: Schema.NullOr(Schema.String).pipe(
    field(408, "Original price used for comparison."),
  ),
  inventoryPolicy: ProductVariantInventoryPolicySchema.pipe(
    field(409, "Behavior when the variant is out of stock."),
  ),
  taxable: Schema.Boolean.pipe(field(410, "Whether the variant is taxable.")),
  createdAt: Schema.Date.pipe(field(411, "Time when the variant was created.")),
  updatedAt: Schema.Date.pipe(field(412, "Time when the variant was last changed.")),
});

export const ProductSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique product identifier.")),
  legacyResourceId: Schema.String.pipe(field(2, "Numeric product identifier stored as text.")),
  title: Schema.String.pipe(field(3, "Title of the product.")),
  handle: Schema.String.pipe(field(4, "URL handle for the product.")),
  descriptionHtml: Schema.String.pipe(field(5, "Product description as HTML.")),
  productType: Schema.String.pipe(field(6, "Merchant-defined product type.")),
  vendor: Schema.String.pipe(field(7, "Vendor of the product.")),
  status: ProductStatusSchema.pipe(field(8, "Current product status.")),
  tags: Schema.Array(Schema.String.annotate({ fieldId: 101 })).pipe(
    field(9, "Tags added to the product."),
  ),
  createdAt: Schema.Date.pipe(field(10, "Time when the product was created.")),
  updatedAt: Schema.Date.pipe(field(11, "Time when the product was last changed.")),
  publishedAt: Schema.NullOr(Schema.Date).pipe(field(12, "Time when the product was published.")),
  templateSuffix: Schema.NullOr(Schema.String).pipe(
    field(13, "Theme template suffix used by the product."),
  ),
  featuredMedia: Schema.NullOr(ProductFeaturedMediaSchema).pipe(
    field(14, "Featured media for the product."),
  ),
  options: Schema.Array(ProductOptionSchema.annotate({ fieldId: 301 })).pipe(
    field(15, "Options for the product."),
  ),
  variants: Schema.Array(ProductVariantSchema.annotate({ fieldId: 401 })).pipe(
    field(16, "Variants of the product."),
  ),
  _af_deleted: Schema.optional(Schema.Boolean).pipe(field(17, "Whether the product was deleted.")),
}).annotate({
  description: "Products in a Shopify store.",
});

export const ProductWebhookImageSchema = Schema.Struct({
  src: Schema.String,
  alt: Schema.NullOr(Schema.String),
});

export const ProductWebhookOptionSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  position: Schema.Int,
  values: Schema.Array(Schema.String),
});

export const ProductWebhookVariantSchema = Schema.Struct({
  admin_graphql_api_id: Schema.String,
  id: Schema.Number,
  title: Schema.String,
  price: Schema.Union([Schema.String, Schema.Number]),
  inventory_policy: RestProductVariantInventoryPolicySchema,
  compare_at_price: Schema.NullOr(Schema.Union([Schema.String, Schema.Number])),
  created_at: Schema.DateFromString,
  updated_at: Schema.DateFromString,
  taxable: Schema.Boolean,
  barcode: Schema.NullOr(Schema.String),
  sku: Schema.NullOr(Schema.String),
});

export const ProductWebhookVariantGidSchema = Schema.Struct({
  admin_graphql_api_id: Schema.String,
  updated_at: Schema.DateFromString,
});

export const ProductWebhookPayloadSchema = Schema.Struct({
  id: Schema.Number,
  admin_graphql_api_id: Schema.String,
  body_html: Schema.NullOr(Schema.String),
  created_at: Schema.NullOr(Schema.DateFromString),
  handle: Schema.String,
  image: Schema.optional(Schema.NullOr(ProductWebhookImageSchema)),
  images: Schema.optional(Schema.Array(Schema.Any)),
  options: Schema.Array(ProductWebhookOptionSchema),
  product_type: Schema.String,
  published_at: Schema.NullOr(Schema.DateFromString),
  published_scope: Schema.optional(Schema.String),
  status: RestProductStatusSchema,
  tags: Schema.String,
  template_suffix: Schema.NullOr(Schema.String),
  title: Schema.String,
  updated_at: Schema.DateFromString,
  variants: Schema.Array(ProductWebhookVariantSchema),
  variant_gids: Schema.Array(ProductWebhookVariantGidSchema),
  vendor: Schema.String,
});

export const ProductDeleteWebhookPayloadSchema = Schema.Struct({ id: Schema.Number });

export const ProductEventSchema = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("upsert"),
    payload: Schema.toType(ProductWebhookPayloadSchema),
  }),
  Schema.Struct({
    _tag: Schema.Literal("delete"),
    id: Schema.String,
    version: Schema.Date,
  }),
]);

export const makeMoneySchema = (baseId: number) => {
  const id = Iceberg.ids(baseId);

  return Schema.Struct({
    amount: Schema.String.pipe(field(id(1), "Money amount as a decimal string.")),
    currency_code: Schema.String.pipe(field(id(2), "Three-letter currency code.")),
  });
};

export const makeMoneyBagSchema = (baseId: number) => {
  const id = Iceberg.ids(baseId);

  return Schema.Struct({
    shop_money: makeMoneySchema(baseId + 10).pipe(field(id(1), "Amount in the shop currency.")),
    presentment_money: makeMoneySchema(baseId + 20).pipe(
      field(id(2), "Amount in the customer currency."),
    ),
  });
};

export const MoneySchema = makeMoneySchema(210);
export const MoneyBagSchema = makeMoneyBagSchema(200);

export const CartLineItemSchema = Schema.Struct({
  id: Schema.String.pipe(field(102, "Unique cart line identifier.")),
  properties: Schema.NullOr(Schema.String).pipe(
    field(103, "Custom line properties stored as JSON."),
  ),
  quantity: Schema.Int.pipe(field(104, "Quantity of the cart line.")),
  variant_id: Schema.String.pipe(field(105, "Product variant identifier stored as text.")),
  key: Schema.String.pipe(field(106, "Unique key for the cart line.")),
  discounted_price: Schema.String.pipe(field(107, "Price after discounts.")),
  discounts: Schema.String.pipe(field(108, "Line discounts stored as JSON.")),
  gift_card: Schema.Boolean.pipe(field(109, "Whether the line is a gift card.")),
  grams: Schema.Int.pipe(field(110, "Weight of the line in grams.")),
  line_price: Schema.String.pipe(field(111, "Total price for the line.")),
  original_line_price: Schema.String.pipe(field(112, "Line price before discounts.")),
  original_price: Schema.String.pipe(field(113, "Unit price before discounts.")),
  price: Schema.String.pipe(field(114, "Current unit price.")),
  product_id: Schema.String.pipe(field(115, "Product identifier stored as text.")),
  sku: Schema.NullOr(Schema.String).pipe(field(116, "Stock keeping unit for the line.")),
  taxable: Schema.Boolean.pipe(field(117, "Whether the line is taxable.")),
  title: Schema.String.pipe(field(118, "Title of the cart line.")),
  total_discount: Schema.String.pipe(field(119, "Total discount for the line.")),
  vendor: Schema.String.pipe(field(120, "Vendor of the product.")),
  discounted_price_set: makeMoneyBagSchema(200).pipe(
    field(121, "Discounted price in shop and presentment currencies."),
  ),
  line_price_set: makeMoneyBagSchema(300).pipe(
    field(122, "Line price in shop and presentment currencies."),
  ),
  original_line_price_set: makeMoneyBagSchema(400).pipe(
    field(123, "Original line price in shop and presentment currencies."),
  ),
  price_set: makeMoneyBagSchema(500).pipe(
    field(124, "Unit price in shop and presentment currencies."),
  ),
  total_discount_set: makeMoneyBagSchema(600).pipe(
    field(125, "Total discount in shop and presentment currencies."),
  ),
  parent_relationship: Schema.NullOr(Schema.String).pipe(
    field(126, "Parent relationship stored as JSON."),
  ),
});

const RawMoneySchema = Schema.Struct({ amount: Schema.String, currency_code: Schema.String });
const RawMoneyBagSchema = Schema.Struct({
  shop_money: RawMoneySchema,
  presentment_money: RawMoneySchema,
});

const CartWebhookLineItemSchema = Schema.Struct({
  id: Schema.Union([Schema.String, Schema.Number]),
  properties: Schema.Union([Schema.Null, JsonStringSchema]),
  quantity: Schema.Int,
  variant_id: Schema.Union([Schema.String, Schema.Number]),
  key: Schema.String,
  discounted_price: Schema.String,
  discounts: JsonStringSchema,
  gift_card: Schema.Boolean,
  grams: Schema.Int,
  line_price: Schema.String,
  original_line_price: Schema.String,
  original_price: Schema.String,
  price: Schema.String,
  product_id: Schema.Union([Schema.String, Schema.Number]),
  sku: Schema.NullOr(Schema.String),
  taxable: Schema.Boolean,
  title: Schema.String,
  total_discount: Schema.String,
  vendor: Schema.String,
  discounted_price_set: RawMoneyBagSchema,
  line_price_set: RawMoneyBagSchema,
  original_line_price_set: RawMoneyBagSchema,
  price_set: RawMoneyBagSchema,
  total_discount_set: RawMoneyBagSchema,
  parent_relationship: Schema.Union([Schema.Null, JsonStringSchema]),
});

export const CartWebhookPayloadSchema = Schema.Struct({
  id: Schema.String,
  token: Schema.String,
  line_items: Schema.Array(CartWebhookLineItemSchema),
  note: Schema.NullOr(Schema.String),
  updated_at: Schema.DateFromString,
  created_at: Schema.DateFromString,
});

export const CartWebhookEventSchema = Schema.Struct({
  id: Schema.String,
  token: Schema.String,
  line_items: Schema.Array(Schema.toType(CartWebhookLineItemSchema)),
  note: Schema.NullOr(Schema.String),
  updated_at: Schema.Date,
  created_at: Schema.Date,
  topic: Schema.Literals(["carts/create", "carts/update"]),
});

export const CartEventSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique cart identifier.")),
  token: Schema.String.pipe(field(2, "Token for the cart.")),
  topic: Schema.Literals(["carts/create", "carts/update"]).pipe(
    field(3, "Webhook topic that produced the row."),
  ),
  lineItems: Schema.Array(CartLineItemSchema.annotate({ fieldId: 101 })).pipe(
    field(4, "Items in the cart."),
  ),
  note: Schema.NullOr(Schema.String).pipe(field(5, "Note added to the cart.")),
  updatedAt: Schema.Date.pipe(field(6, "Time when the cart was last changed.")),
  createdAt: Schema.Date.pipe(field(7, "Time when the cart was created.")),
}).annotate({
  description: "Cart create and update events from a Shopify store.",
});

export const WebhookPayloadSchema = Schema.Unknown;

export const tableSchemas: Readonly<Record<string, Schema.Top>> = {
  products: ProductSchema,
  cart_events: CartEventSchema,
};

const splitTags = (value: string): ReadonlyArray<string> => {
  if (value.trim() === "") return [];

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
};

const normalizeProductStatus = (status: RestProductStatus): ProductStatus => {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "archived":
      return "ARCHIVED";
    case "draft":
      return "DRAFT";
  }
};

const normalizeInventoryPolicy = (
  policy: RestProductVariantInventoryPolicy,
): ProductVariantInventoryPolicy => {
  switch (policy) {
    case "continue":
      return "CONTINUE";
    case "deny":
      return "DENY";
  }
};

const normalizeProductOption = (option: ProductWebhookOption): ProductOption => ({
  id: `gid://shopify/ProductOption/${option.id}`,
  name: option.name,
  position: option.position,
  values: option.values,
});

const normalizeProductVariant = (variant: ProductWebhookVariant): ProductVariant => ({
  id: variant.admin_graphql_api_id,
  legacyResourceId: String(variant.id),
  title: variant.title,
  sku: variant.sku,
  barcode: variant.barcode,
  price: String(variant.price),
  compareAtPrice: variant.compare_at_price === null ? null : String(variant.compare_at_price),
  inventoryPolicy: normalizeInventoryPolicy(variant.inventory_policy),
  taxable: variant.taxable,
  createdAt: variant.created_at,
  updatedAt: variant.updated_at,
});

const normalizeProductFeaturedMedia = (
  image: ProductWebhookImage | null | undefined,
): ProductFeaturedMedia | null =>
  image === null || image === undefined ? null : { image: { url: image.src, altText: image.alt } };

const normalizeCartLineItem = (item: CartWebhookLineItem): CartLineItem => ({
  ...item,
  id: String(item.id),
  variant_id: String(item.variant_id),
  product_id: String(item.product_id),
});

export const ShopifyNormalize = {
  productWebhook: (payload: ProductWebhookPayload & { readonly created_at: Date }): Product => ({
    id: payload.admin_graphql_api_id,
    legacyResourceId: String(payload.id),
    title: payload.title,
    handle: payload.handle,
    descriptionHtml: payload.body_html ?? "",
    productType: payload.product_type,
    vendor: payload.vendor,
    status: normalizeProductStatus(payload.status),
    tags: splitTags(payload.tags),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    publishedAt: payload.published_at,
    templateSuffix: payload.template_suffix,
    featuredMedia: normalizeProductFeaturedMedia(payload.image),
    options: payload.options.map(normalizeProductOption),
    variants: payload.variants.map(normalizeProductVariant),
  }),

  cartWebhook: (
    payload: CartWebhookPayload,
    topic: "carts/create" | "carts/update",
  ): CartEvent => ({
    id: payload.id,
    token: payload.token,
    topic,
    lineItems: payload.line_items.map(normalizeCartLineItem),
    note: payload.note,
    updatedAt: payload.updated_at,
    createdAt: payload.created_at,
  }),
} as const;

export type PageInfo = Schema.Schema.Type<typeof PageInfoSchema>;
export type ProductStatus = Schema.Schema.Type<typeof ProductStatusSchema>;
export type RestProductStatus = Schema.Schema.Type<typeof RestProductStatusSchema>;
export type ProductVariantInventoryPolicy = Schema.Schema.Type<
  typeof ProductVariantInventoryPolicySchema
>;
export type RestProductVariantInventoryPolicy = Schema.Schema.Type<
  typeof RestProductVariantInventoryPolicySchema
>;
export type ProductFeaturedMedia = Schema.Schema.Type<typeof ProductFeaturedMediaSchema>;
export type ProductOption = Schema.Schema.Type<typeof ProductOptionSchema>;
export type ProductVariant = Schema.Schema.Type<typeof ProductVariantSchema>;
export type ProductWebhookImage = Schema.Schema.Type<typeof ProductWebhookImageSchema>;
export type ProductWebhookOption = Schema.Schema.Type<typeof ProductWebhookOptionSchema>;
export type ProductWebhookVariant = Schema.Schema.Type<typeof ProductWebhookVariantSchema>;
export type ProductWebhookVariantGid = Schema.Schema.Type<typeof ProductWebhookVariantGidSchema>;
export type Product = Schema.Schema.Type<typeof ProductSchema>;
export type ProductWebhookPayload = Schema.Schema.Type<typeof ProductWebhookPayloadSchema>;
export type ProductDeleteWebhookPayload = Schema.Schema.Type<
  typeof ProductDeleteWebhookPayloadSchema
>;
export type Money = Schema.Schema.Type<typeof MoneySchema>;
export type MoneyBag = Schema.Schema.Type<typeof MoneyBagSchema>;
export type CartLineItem = Schema.Schema.Type<typeof CartLineItemSchema>;
export type CartWebhookLineItem = Schema.Schema.Type<typeof CartWebhookLineItemSchema>;
export type CartWebhookPayload = Schema.Schema.Type<typeof CartWebhookPayloadSchema>;
export type CartEvent = Schema.Schema.Type<typeof CartEventSchema>;
export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
