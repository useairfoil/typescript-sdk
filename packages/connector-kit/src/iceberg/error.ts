import { Data } from "effect";

/** A schema could not be turned into an Iceberg table. */
export class IcebergSchemaError extends Data.TaggedError("IcebergSchemaError")<{
  /** Schema path, such as `$.orders.element`. */
  readonly path: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}
