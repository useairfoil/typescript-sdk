import * as Schema from "effect/Schema";

export const PageInfoSchema = Schema.Struct({
  hasNextPage: Schema.Boolean,
  endCursor: Schema.NullOr(Schema.String),
});

export const ProductStatusSchema = Schema.Literals(["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"]);

export type ProductStatus = Schema.Schema.Type<typeof ProductStatusSchema>;

export const RestProductStatusSchema = Schema.Literals(["active", "archived", "draft"]);

export type RestProductStatus = Schema.Schema.Type<typeof RestProductStatusSchema>;

export const ProductVariantInventoryPolicySchema = Schema.Literals(["CONTINUE", "DENY"]);

export type ProductVariantInventoryPolicy = Schema.Schema.Type<
  typeof ProductVariantInventoryPolicySchema
>;

export const RestProductVariantInventoryPolicySchema = Schema.Literals(["continue", "deny"]);

export type RestProductVariantInventoryPolicy = Schema.Schema.Type<
  typeof RestProductVariantInventoryPolicySchema
>;

export const ProductFeaturedMediaSchema = Schema.Any;

export type ProductFeaturedMedia = Schema.Schema.Type<typeof ProductFeaturedMediaSchema>;

export const ProductOptionSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  position: Schema.Number,
  values: Schema.Array(Schema.String),
});

export type ProductOption = Schema.Schema.Type<typeof ProductOptionSchema>;

export const ProductVariantSchema = Schema.Struct({
  id: Schema.String,
  legacyResourceId: Schema.String,
  title: Schema.String,
  sku: Schema.NullOr(Schema.String),
  barcode: Schema.NullOr(Schema.String),
  price: Schema.String,
  compareAtPrice: Schema.NullOr(Schema.String),
  inventoryPolicy: ProductVariantInventoryPolicySchema,
  taxable: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export type ProductVariant = Schema.Schema.Type<typeof ProductVariantSchema>;

export const ProductWebhookImageSchema = Schema.Struct({
  src: Schema.String,
});

export type ProductWebhookImage = Schema.Schema.Type<typeof ProductWebhookImageSchema>;

export const ProductWebhookOptionSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  position: Schema.Number,
  values: Schema.Array(Schema.String),
});

export type ProductWebhookOption = Schema.Schema.Type<typeof ProductWebhookOptionSchema>;

export const ProductWebhookVariantSchema = Schema.Struct({
  admin_graphql_api_id: Schema.String,
  id: Schema.Number,
  title: Schema.String,
  price: Schema.Union([Schema.String, Schema.Number]),
  inventory_policy: RestProductVariantInventoryPolicySchema,
  compare_at_price: Schema.NullOr(Schema.Union([Schema.String, Schema.Number])),
  created_at: Schema.String,
  updated_at: Schema.String,
  taxable: Schema.Boolean,
  barcode: Schema.NullOr(Schema.String),
  sku: Schema.NullOr(Schema.String),
});

export type ProductWebhookVariant = Schema.Schema.Type<typeof ProductWebhookVariantSchema>;

export const ProductSchema = Schema.Struct({
  id: Schema.String,
  legacyResourceId: Schema.String,
  title: Schema.String,
  handle: Schema.String,
  descriptionHtml: Schema.String,
  productType: Schema.String,
  vendor: Schema.String,
  status: ProductStatusSchema,
  tags: Schema.Array(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  publishedAt: Schema.NullOr(Schema.String),
  templateSuffix: Schema.NullOr(Schema.String),
  featuredMedia: Schema.NullOr(ProductFeaturedMediaSchema),
  options: Schema.Array(ProductOptionSchema),
  variantsFirstPage: Schema.Array(ProductVariantSchema),
  variantsPageInfo: PageInfoSchema,
});

export type Product = Schema.Schema.Type<typeof ProductSchema>;

export const ProductWebhookPayloadSchema = Schema.Struct({
  id: Schema.Number,
  admin_graphql_api_id: Schema.String,
  body_html: Schema.NullOr(Schema.String),
  created_at: Schema.NullOr(Schema.String),
  handle: Schema.String,
  image: Schema.optional(Schema.NullOr(ProductWebhookImageSchema)),
  images: Schema.optional(Schema.Array(Schema.Any)),
  options: Schema.Array(ProductWebhookOptionSchema),
  product_type: Schema.String,
  published_at: Schema.NullOr(Schema.String),
  published_scope: Schema.optional(Schema.String),
  status: RestProductStatusSchema,
  tags: Schema.String,
  template_suffix: Schema.NullOr(Schema.String),
  title: Schema.String,
  updated_at: Schema.String,
  variants: Schema.Array(ProductWebhookVariantSchema),
  vendor: Schema.String,
});

export type ProductWebhookPayload = Schema.Schema.Type<typeof ProductWebhookPayloadSchema>;

export const MoneySchema = Schema.Struct({
  amount: Schema.String,
  currency_code: Schema.String,
});

export const MoneyBagSchema = Schema.Struct({
  shop_money: MoneySchema,
  presentment_money: MoneySchema,
});

export const CartLineItemSchema = Schema.Struct({
  id: Schema.Union([Schema.String, Schema.Number]),
  properties: Schema.NullOr(Schema.Unknown),
  quantity: Schema.Number,
  variant_id: Schema.Union([Schema.String, Schema.Number]),
  key: Schema.String,
  discounted_price: Schema.String,
  discounts: Schema.Array(Schema.Unknown),
  gift_card: Schema.Boolean,
  grams: Schema.Number,
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
  discounted_price_set: MoneyBagSchema,
  line_price_set: MoneyBagSchema,
  original_line_price_set: MoneyBagSchema,
  price_set: MoneyBagSchema,
  total_discount_set: MoneyBagSchema,
  parent_relationship: Schema.NullOr(Schema.Unknown),
});

export type CartLineItem = Schema.Schema.Type<typeof CartLineItemSchema>;

export const CartWebhookPayloadSchema = Schema.Struct({
  id: Schema.String,
  token: Schema.String,
  line_items: Schema.Array(CartLineItemSchema),
  note: Schema.NullOr(Schema.String),
  updated_at: Schema.String,
  created_at: Schema.String,
});

export type CartWebhookPayload = Schema.Schema.Type<typeof CartWebhookPayloadSchema>;

export const CartEventSchema = Schema.Struct({
  id: Schema.String,
  token: Schema.String,
  topic: Schema.Literals(["carts/create", "carts/update"]),
  lineItems: Schema.Array(CartLineItemSchema),
  note: Schema.NullOr(Schema.String),
  updatedAt: Schema.String,
  createdAt: Schema.String,
});

export type CartEvent = Schema.Schema.Type<typeof CartEventSchema>;

export const WebhookPayloadSchema = Schema.Unknown;

export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;

const splitTags = (value: string): ReadonlyArray<string> => {
  if (value.trim() === "") {
    return [];
  }
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

const normalizeProductOption = (restOption: ProductWebhookOption): ProductOption => {
  return {
    id: String(restOption.id),
    name: restOption.name,
    position: restOption.position,
    values: restOption.values,
  };
};

const normalizeProductVariant = (restVariant: ProductWebhookVariant): ProductVariant => {
  return {
    id: restVariant.admin_graphql_api_id,
    legacyResourceId: String(restVariant.id),
    title: restVariant.title,
    sku: restVariant.sku,
    barcode: restVariant.barcode,
    price: String(restVariant.price),
    compareAtPrice:
      restVariant.compare_at_price === null ? null : String(restVariant.compare_at_price),
    inventoryPolicy: normalizeInventoryPolicy(restVariant.inventory_policy),
    taxable: restVariant.taxable,
    createdAt: restVariant.created_at,
    updatedAt: restVariant.updated_at,
  };
};

const normalizeProductFeaturedMedia = (
  image: ProductWebhookImage | null | undefined,
): ProductFeaturedMedia | null => {
  if (image === null || image === undefined) {
    return null;
  }

  return {
    image: {
      url: image.src,
      altText: null,
    },
  };
};

export const ShopifyNormalize = {
  productWebhook: (payload: ProductWebhookPayload): Product => ({
    id: payload.admin_graphql_api_id,
    legacyResourceId: String(payload.id),
    title: payload.title,
    handle: payload.handle,
    descriptionHtml: payload.body_html ?? "",
    productType: payload.product_type,
    vendor: payload.vendor,
    status: normalizeProductStatus(payload.status),
    tags: splitTags(payload.tags),
    createdAt: payload.created_at ?? payload.updated_at,
    updatedAt: payload.updated_at,
    publishedAt: payload.published_at,
    templateSuffix: payload.template_suffix,
    featuredMedia: normalizeProductFeaturedMedia(payload.image),
    options: payload.options.map(normalizeProductOption),
    variantsFirstPage: payload.variants.map(normalizeProductVariant),
    variantsPageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
  }),

  cartWebhook: (
    payload: CartWebhookPayload,
    topic: "carts/create" | "carts/update",
  ): CartEvent => ({
    id: payload.id,
    token: payload.token,
    topic,
    lineItems: payload.line_items,
    note: payload.note,
    updatedAt: payload.updated_at,
    createdAt: payload.created_at,
  }),
} as const;
