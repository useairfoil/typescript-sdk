import { Data } from "effect";

export class GrpcError extends Data.TaggedError("GrpcError")<{
  readonly message: string;
  readonly status: number;
  readonly cause?: unknown;
}> {}
