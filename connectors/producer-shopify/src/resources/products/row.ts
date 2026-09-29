import * as Schema from "effect/Schema";

import { field } from "../shared";

export const ProductStatusSchema = Schema.Literals(["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"]);

export const ProductVariantInventoryPolicySchema = Schema.Literals(["CONTINUE", "DENY"]);

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

export type ProductStatus = Schema.Schema.Type<typeof ProductStatusSchema>;

export type ProductVariantInventoryPolicy = Schema.Schema.Type<
  typeof ProductVariantInventoryPolicySchema
>;

export type ProductFeaturedMedia = Schema.Schema.Type<typeof ProductFeaturedMediaSchema>;

export type ProductOption = Schema.Schema.Type<typeof ProductOptionSchema>;

export type ProductVariant = Schema.Schema.Type<typeof ProductVariantSchema>;

export type Product = Schema.Schema.Type<typeof ProductSchema>;
