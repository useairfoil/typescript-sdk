import * as Schema from "effect/Schema";

export const ProductSchema = Schema.Struct({
  id: Schema.Number,
  admin_graphql_api_id: Schema.String,
  body_html: Schema.NullOr(Schema.String),
  created_at: Schema.String,
  handle: Schema.String,
  image: Schema.NullOr(Schema.Any),
  images: Schema.Array(Schema.Any),
  options: Schema.Array(Schema.Any),
  product_type: Schema.String,
  published_at: Schema.NullOr(Schema.String),
  published_scope: Schema.optional(Schema.String),
  status: Schema.String,
  tags: Schema.String,
  template_suffix: Schema.NullOr(Schema.String),
  title: Schema.String,
  updated_at: Schema.String,
  variants: Schema.Array(Schema.Any),
  vendor: Schema.String,
});

export type Product = Schema.Schema.Type<typeof ProductSchema>;

export const WebhookPayloadSchema = ProductSchema;

export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
