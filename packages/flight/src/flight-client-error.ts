import { Data } from "effect";

export class FlightClientError extends Data.TaggedError("FlightClientError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FlightTransportError extends Data.TaggedError("FlightTransportError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FlightDecodeError extends Data.TaggedError("FlightDecodeError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FlightProtocolError extends Data.TaggedError("FlightProtocolError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type FlightClientErrorLike =
  | FlightClientError
  | FlightTransportError
  | FlightDecodeError
  | FlightProtocolError;
