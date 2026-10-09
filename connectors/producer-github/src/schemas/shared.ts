import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, SchemaTransformation } from "effect";

export const field = (fieldId: number, description: string) =>
  Iceberg.field(fieldId, { description });

/** IDs and counts. Connector Kit maps whole numbers to Iceberg longs. */
export const Long = Schema.Int.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => BigInt(value),
      encode: (value) => Number(value),
    }),
  ),
);

export const Timestamp = Schema.DateFromString;

/**
 * Text GitHub can clear, such as a body. A stored column can't be set back to
 * null, so `null` becomes an empty string.
 */
export const Text = Schema.NullOr(Schema.String).pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transform({
      decode: (value) => value ?? "",
      encode: (value) => value,
    }),
  ),
);

/**
 * `null` becomes an empty list. A missing list stays missing, so a webhook
 * can't erase it. Full rows fill it with `[]`.
 */
export const optionalList = <S extends Schema.Top>(item: S) =>
  Schema.optionalKey(
    Schema.NullOr(Schema.Array(item)).pipe(
      Schema.decodeTo(
        Schema.Array(Schema.toType(item)),
        SchemaTransformation.transform({
          decode: (value) => value ?? [],
          encode: (value) => value,
        }),
      ),
    ),
  );

// Each helper takes the first field ID of its block.
export const user = (baseId: number) =>
  Schema.Struct({
    id: Long.pipe(field(baseId, "GitHub user ID.")),
    login: Schema.String.pipe(field(baseId + 1, "GitHub username.")),
    type: Schema.String.pipe(
      field(baseId + 2, "Account type, such as User, Bot, or Organization."),
    ),
  });

export const label = (baseId: number) =>
  Schema.Struct({
    id: Long.pipe(field(baseId, "Label ID.")),
    name: Schema.String.pipe(field(baseId + 1, "Label name.")),
  });

export const milestone = (baseId: number) =>
  Schema.Struct({
    id: Long.pipe(field(baseId, "Milestone ID.")),
    number: Long.pipe(field(baseId + 1, "Milestone number in the repository.")),
    title: Schema.String.pipe(field(baseId + 2, "Milestone title.")),
  });

/** A list column. The element ID is separate from the column's field ID. */
export const list = <S extends Schema.Top>(elementId: number, item: S) =>
  Schema.Array(item.annotate({ fieldId: elementId }));

export const version = (fieldId: number, object: string) =>
  Schema.Date.pipe(field(fieldId, `Time GitHub last updated the ${object}.`));

export const deleted = (fieldId: number, object: string) =>
  Schema.optional(Schema.Boolean).pipe(
    field(fieldId, `Whether the ${object} was deleted in GitHub.`),
  );

export const ObjectRefSchema = Schema.Struct({ id: Long });
