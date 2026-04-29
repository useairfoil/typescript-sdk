import { Data } from "effect";

export class ClusterClientError extends Data.TaggedError("ClusterClientError")<{
  readonly message: string;
  readonly code?: string;
  readonly cause?: unknown;
}> {}
