import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, SchemaTransformation } from "effect";

export const field = (fieldId: number, description: string) =>
  Iceberg.field(fieldId, { description });

// Stripe times are Unix seconds.
export const UnixTime = Schema.Int.pipe(
  Schema.decodeTo(
    Schema.Date,
    SchemaTransformation.transform({
      decode: (seconds) => new Date(seconds * 1000),
      encode: (date) => Math.floor(date.getTime() / 1000),
    }),
  ),
);

export const Long = Schema.Int.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => BigInt(value),
      encode: (value) => Number(value),
    }),
  ),
);

// Some objects send `null` metadata. It becomes an empty map.
export const Metadata = Schema.NullOr(Schema.Record(Schema.String, Schema.String)).pipe(
  Schema.decodeTo(
    Schema.ReadonlyMap(
      Schema.String.annotate({ fieldId: 200, description: "Metadata key." }),
      Schema.String.annotate({ fieldId: 201, description: "Metadata value." }),
    ),
    SchemaTransformation.transform({
      decode: (record): ReadonlyMap<string, string> => new Map(Object.entries(record ?? {})),
      encode: (map) => Object.fromEntries(map),
    }),
  ),
);

// Each helper takes the first field ID of its block.
export const address = (baseId: number) =>
  Schema.Struct({
    line1: Schema.NullOr(Schema.String).pipe(field(baseId, "First address line.")),
    line2: Schema.NullOr(Schema.String).pipe(field(baseId + 1, "Second address line.")),
    city: Schema.NullOr(Schema.String).pipe(field(baseId + 2, "City.")),
    state: Schema.NullOr(Schema.String).pipe(field(baseId + 3, "State, county, or region.")),
    postal_code: Schema.NullOr(Schema.String).pipe(field(baseId + 4, "Postal code.")),
    country: Schema.NullOr(Schema.String).pipe(field(baseId + 5, "Two-letter country code.")),
  });

export const shipping = (baseId: number) =>
  Schema.Struct({
    name: Schema.String.pipe(field(baseId, "Recipient name.")),
    phone: Schema.NullOr(Schema.String).pipe(field(baseId + 1, "Recipient phone number.")),
    address: address(baseId + 3).pipe(field(baseId + 2, "Shipping address.")),
  });

export const version = (fieldId: number) =>
  Schema.Date.pipe(field(fieldId, "Time the row was fetched from Stripe."));

export const deleted = (fieldId: number) =>
  Schema.optional(Schema.Boolean).pipe(field(fieldId, "Whether the object was deleted in Stripe."));
