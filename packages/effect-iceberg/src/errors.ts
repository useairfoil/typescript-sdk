import { Data } from "effect";
import { IcebergError } from "iceberg-js";

/** Error type used by the Effect wrapper around `iceberg-js`. */
export class IcebergCatalogError extends Data.TaggedError("IcebergCatalogError")<{
  readonly message: string;
  readonly status?: number;
  readonly icebergType?: string;
  readonly icebergCode?: number;
  readonly details?: unknown;
  readonly isCommitStateUnknown?: boolean;
  readonly cause?: unknown;
}> {}

/** Converts errors thrown by `iceberg-js` into `IcebergCatalogError`. */
export const toIcebergCatalogError = (error: unknown): IcebergCatalogError => {
  if (error instanceof IcebergError) {
    return new IcebergCatalogError({
      message: error.message,
      status: error.status,
      icebergType: error.icebergType,
      icebergCode: error.icebergCode,
      details: error.details,
      isCommitStateUnknown: error.isCommitStateUnknown,
      cause: error,
    });
  }

  return new IcebergCatalogError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
};
