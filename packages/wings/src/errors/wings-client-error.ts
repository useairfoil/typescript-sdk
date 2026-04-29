import { Data } from "effect";

export class WingsError extends Data.TaggedError("WingsError")<{
  readonly message: string;
  readonly code?: string;
  readonly cause?: unknown;
}> {}
