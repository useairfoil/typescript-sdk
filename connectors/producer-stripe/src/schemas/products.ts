import { Schema, Struct } from "effect";

import { Metadata, UnixTime, deleted, field, version } from "./shared";

export const ProductSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Unique product identifier.")),
  version: version(2),
  created: UnixTime.pipe(field(3, "Time when the product was created.")),
  updated: UnixTime.pipe(field(4, "Time when the product was last changed, in whole seconds.")),
  livemode: Schema.Boolean.pipe(field(5, "Whether the product exists in live mode.")),
  active: Schema.Boolean.pipe(field(6, "Whether the product can be bought. False when archived.")),
  name: Schema.String.pipe(field(7, "Product name.")),
  description: Schema.NullOr(Schema.String).pipe(field(8, "Product description.")),
  default_price: Schema.NullOr(Schema.String).pipe(field(9, "Default price of the product.")),
  tax_code: Schema.NullOr(Schema.String).pipe(field(10, "Tax code of the product.")),
  unit_label: Schema.NullOr(Schema.String).pipe(field(11, "Label for units on receipts.")),
  url: Schema.NullOr(Schema.String).pipe(field(12, "Public web page of the product.")),
  shippable: Schema.NullOr(Schema.Boolean).pipe(
    field(13, "Whether the product is shipped as physical goods."),
  ),
  statement_descriptor: Schema.NullOr(Schema.String).pipe(
    field(14, "Text shown on card statements for subscription payments."),
  ),
  metadata: Metadata.pipe(field(15, "Key-value pairs set on the product.")),
  _deleted: deleted(16),
}).annotate({
  description: "Products in a Stripe account, including archived ones.",
});

export type Product = Schema.Schema.Type<typeof ProductSchema>;

export const ProductObjectSchema = ProductSchema.mapFields(Struct.omit(["version", "_deleted"]));

export type ProductObject = Schema.Schema.Type<typeof ProductObjectSchema>;
