import { Data } from "effect";

export class ConnectorError extends Data.TaggedError("ConnectorError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
