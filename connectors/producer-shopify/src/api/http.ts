import { Metrics } from "@useairfoil/connector-kit";
import { Duration, Effect, Predicate, Schedule } from "effect";
import { HttpClientResponse } from "effect/http";

import { manifest } from "../manifest";

// Effect exports the response type ID, not a guard.
const isResponse = (value: unknown): value is HttpClientResponse.HttpClientResponse =>
  Predicate.hasProperty(value, HttpClientResponse.TypeId);

const retryAfterFallback = Duration.seconds(1);

export const retrySchedule = (options: {
  readonly maxRetries: number;
  readonly baseDelay: Duration.Duration;
}) =>
  Metrics.retrySchedule({
    connector: manifest.name,
    baseDelay: options.baseDelay,
    times: options.maxRetries,
  }).pipe(
    Schedule.modifyDelay(({ input, duration }) => {
      if (!isResponse(input) || input.status !== 429) return Effect.succeed(duration);
      const seconds = Number(input.headers["retry-after"]);
      return Effect.succeed(
        Number.isFinite(seconds) ? Duration.seconds(seconds) : retryAfterFallback,
      );
    }),
  );
