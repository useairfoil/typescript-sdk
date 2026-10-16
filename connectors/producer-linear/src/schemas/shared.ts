import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, SchemaTransformation } from "effect";

export const field = (fieldId: number, description: string) =>
  Iceberg.field(fieldId, { description });

export const Timestamp = Schema.DateFromString;

/** Decodes a GraphQL Int as bigint for an Iceberg long. */
export const Long = Schema.Int.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => BigInt(value),
      encode: (value) => Number(value),
    }),
  ),
);

/** Decodes a linked object such as `assignee { id }` as its ID. */
export const Ref = Schema.Struct({ id: Schema.String }).pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transform({
      decode: (ref) => ref.id,
      encode: (id) => ({ id }),
    }),
  ),
);

export const OptionalRef = Schema.NullOr(Ref);

export const OptionalTimestamp = Schema.NullOr(Timestamp);

export const OptionalString = Schema.NullOr(Schema.String);

const RefConnection = Schema.Struct({ nodes: Schema.Array(Schema.Struct({ id: Schema.String })) });

/** Decodes connection nodes as IDs. The query must fetch any extra pages. */
export const RefList = (elementId: number) =>
  RefConnection.pipe(
    Schema.decodeTo(
      Schema.Array(Schema.String.annotate({ fieldId: elementId })),
      SchemaTransformation.transform<ReadonlyArray<string>, typeof RefConnection.Type>({
        decode: (connection) => connection.nodes.map((node) => node.id),
        encode: (ids) => ({ nodes: ids.map((id) => ({ id })) }),
      }),
    ),
  );

export const list = <S extends Schema.Top>(elementId: number, item: S) =>
  Schema.Array(item.annotate({ fieldId: elementId }));

/** Rows use updated_at as version; lifecycle webhooks use the webhook time. */
export const common = (object: string) => ({
  id: Schema.String.pipe(field(1, `${object} ID.`)),
  version: Schema.Date.pipe(field(2, `Time Linear last changed the ${object.toLowerCase()}.`)),
  created_at: Timestamp.pipe(field(3, `Time the ${object.toLowerCase()} was created.`)),
  updated_at: Timestamp.pipe(field(4, `Time the ${object.toLowerCase()} was last updated.`)),
  archived_at: Schema.NullOr(Timestamp).pipe(
    field(5, `Time the ${object.toLowerCase()} was archived or trashed.`),
  ),
});

export const deleted = (object: string) =>
  Schema.optional(Schema.Boolean).pipe(field(6, `Whether the ${object} was deleted in Linear.`));
