import { Data } from "effect";
import { IcebergError as IcebergJsError } from "iceberg-js";

/** Error type used by the Effect wrapper around `iceberg-js`. */
export class IcebergError extends Data.TaggedError("IcebergError")<{
  readonly message: string;
  readonly status?: number;
  readonly icebergType?: string;
  readonly icebergCode?: number;
  readonly details?: unknown;
  readonly isCommitStateUnknown?: boolean;
  readonly cause?: unknown;
}> {}

/** Maps errors thrown by `iceberg-js` into `IcebergError`. */
export const mapIcebergError = (error: unknown): IcebergError => {
  if (error instanceof IcebergJsError) {
    return new IcebergError({
      message: error.message,
      status: error.status,
      icebergType: error.icebergType,
      icebergCode: error.icebergCode,
      details: error.details,
      isCommitStateUnknown: error.isCommitStateUnknown,
      cause: error,
    });
  }

  return new IcebergError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
};
