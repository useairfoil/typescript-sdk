import { Data } from "effect";

export class ClusterMetadataError extends Data.TaggedError(
  "ClusterMetadataError",
)<{
  readonly message: string;
  readonly code?: string;
  readonly cause?: unknown;
}> {}

export class WingsError extends Data.TaggedError("WingsError")<{
  readonly message: string;
  readonly code?: string;
  readonly cause?: unknown;
}> {}

export class GrpcError extends Data.TaggedError("GrpcError")<{
  readonly message: string;
  readonly status: number;
  readonly cause?: unknown;
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
