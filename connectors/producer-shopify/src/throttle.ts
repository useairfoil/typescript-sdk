// Shopify reports GraphQL throttling in HTTP 200 responses.
// https://shopify.dev/docs/api/usage/limits
import { Duration, Effect, Option, Random, Schema } from "effect";

const ThrottleStatusSchema = Schema.Struct({
  maximumAvailable: Schema.Number,
  currentlyAvailable: Schema.Number,
  restoreRate: Schema.Number,
});

export type ThrottleStatus = Schema.Schema.Type<typeof ThrottleStatusSchema>;

const GraphQLErrorSchema = Schema.Struct({
  extensions: Schema.optional(Schema.Struct({ code: Schema.optional(Schema.String) })),
});

const GraphQLEnvelopeSchema = Schema.Struct({
  errors: Schema.optional(Schema.Array(GraphQLErrorSchema)),
  extensions: Schema.optional(
    Schema.Struct({
      cost: Schema.optional(
        Schema.Struct({
          requestedQueryCost: Schema.optional(Schema.Number),
          throttleStatus: Schema.optional(ThrottleStatusSchema),
        }),
      ),
    }),
  ),
});

const decodeEnvelope = Schema.decodeUnknownOption(GraphQLEnvelopeSchema);

const readThrottleCost = (
  body: unknown,
): { readonly requestedQueryCost: number; readonly status: ThrottleStatus } | undefined =>
  decodeEnvelope(body).pipe(
    Option.flatMap((envelope) => {
      const cost = envelope.extensions?.cost;
      const status = cost?.throttleStatus;
      const requestedQueryCost = cost?.requestedQueryCost;
      return status === undefined || requestedQueryCost === undefined
        ? Option.none()
        : Option.some({ requestedQueryCost, status });
    }),
    Option.getOrUndefined,
  );

const retryableCodes = new Set(["THROTTLED", "INTERNAL_SERVER_ERROR"]);

export type RetryableErrorCode = "THROTTLED" | "INTERNAL_SERVER_ERROR";

/** Retries only when every GraphQL error is transient. */
export const retryableErrorCode = (body: unknown): RetryableErrorCode | undefined =>
  decodeEnvelope(body).pipe(
    Option.flatMap((envelope) => {
      const codes = envelope.errors?.map((error) => error.extensions?.code) ?? [];
      const allRetryable =
        codes.length > 0 && codes.every((code) => code !== undefined && retryableCodes.has(code));
      if (!allRetryable) return Option.none<RetryableErrorCode>();
      return Option.some<RetryableErrorCode>(
        codes.includes("THROTTLED") ? "THROTTLED" : "INTERNAL_SERVER_ERROR",
      );
    }),
    Option.getOrUndefined,
  );

const backoff = (baseDelay: Duration.Duration, attempt: number): Effect.Effect<Duration.Duration> =>
  Random.nextBetween(0.8, 1.2).pipe(
    Effect.map((jitter) => Duration.times(baseDelay, 2 ** attempt * jitter)),
  );

/** Uses Shopify's cost deficit for throttling and backoff for internal errors. */
export const retryDelay = (
  code: RetryableErrorCode,
  body: unknown,
  attempt: number,
  options: { readonly baseDelay: Duration.Duration },
): Effect.Effect<Duration.Duration> => {
  if (code === "INTERNAL_SERVER_ERROR") return backoff(options.baseDelay, attempt);
  const cost = readThrottleCost(body);
  if (cost === undefined || cost.status.restoreRate <= 0) {
    return backoff(options.baseDelay, attempt);
  }
  const deficitMillis =
    (Math.max(0, cost.requestedQueryCost - cost.status.currentlyAvailable) /
      cost.status.restoreRate) *
    1000;
  return Effect.succeed(Duration.max(Duration.millis(Math.ceil(deficitMillis)), options.baseDelay));
};
