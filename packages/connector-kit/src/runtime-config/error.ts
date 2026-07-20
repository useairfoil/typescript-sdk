import { Data } from "effect";

export type RuntimeConfigErrorCode =
  | "CONFIG_PATH_MISSING"
  | "CONFIG_FILE_UNREADABLE"
  | "CONFIG_JSON_INVALID";

/** Expected hosted-config failure with a stable code and diagnostic cause. */
export class RuntimeConfigError extends Data.TaggedError("RuntimeConfigError")<{
  readonly code: RuntimeConfigErrorCode;
  readonly message: string;
  readonly cause: Error;
}> {}
