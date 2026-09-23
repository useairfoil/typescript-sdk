import { Schema } from "effect";

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly fieldId?: number | undefined;
    }
  }
}

/** Sets a field's Iceberg ID, and any other annotations. */
export const field =
  <A = unknown>(fieldId: number, annotations: Schema.Annotations.Key<A> = {}) =>
  <S extends Schema.Schema<A>>(schema: S): S["Rebuild"] =>
    schema.pipe(Schema.annotateKey({ ...annotations, fieldId }));

/** Adds an offset to a base ID for reusable schemas. */
export const ids =
  (baseId: number) =>
  (offset: number): number =>
    baseId + offset;
