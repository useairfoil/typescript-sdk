import { Schema } from "effect";

/**
 * Helper function to create a discriminated union tag field.
 * Maps from `$case` (protobuf) to `_tag` (application).
 */
export function tag<T extends string>(tag: T) {
  return Schema.Literal(tag).pipe(
    Schema.propertySignature,
    Schema.fromKey("$case"),
  );
}
