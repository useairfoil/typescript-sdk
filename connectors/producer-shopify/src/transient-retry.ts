import { Clock, Duration, Effect, Random } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

const parseRetryAfter = (
  header: string | undefined,
  atMillis: number,
): Duration.Duration | undefined => {
  if (header === undefined || header.trim() === "") return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Duration.seconds(Math.max(seconds, 0));
  const parsedDate = Date.parse(header);
  return Number.isNaN(parsedDate) ? undefined : Duration.millis(Math.max(parsedDate - atMillis, 0));
};

const otherTransientStatuses = new Set([408, 500, 502, 503, 504]);

const backoff = (baseDelay: Duration.Duration, attempt: number): Effect.Effect<Duration.Duration> =>
  Random.nextBetween(0.8, 1.2).pipe(
    Effect.map((jitter) => Duration.times(baseDelay, 2 ** attempt * jitter)),
  );

const delayFor = (
  response: HttpClientResponse.HttpClientResponse,
  attempt: number,
  options: {
    readonly baseDelay: Duration.Duration;
    readonly retryAfterFallback: Duration.Duration;
  },
): Effect.Effect<Duration.Duration> => {
  if (response.status !== 429) return backoff(options.baseDelay, attempt);
  return Clock.currentTimeMillis.pipe(
    Effect.map(
      (now) => parseRetryAfter(response.headers["retry-after"], now) ?? options.retryAfterFallback,
    ),
  );
};

/** Retries transient responses and honors Shopify's `Retry-After` header on 429. */
export const withTransientRetry = <E, R>(
  client: HttpClient.HttpClient.With<E, R>,
  options: {
    readonly maxRetries: number;
    readonly baseDelay: Duration.Duration;
    readonly retryAfterFallback: Duration.Duration;
  },
): HttpClient.HttpClient.With<E, R> => {
  const loop = (
    effect: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>,
    remaining: number,
    attempt: number,
  ): Effect.Effect<HttpClientResponse.HttpClientResponse, E, R> =>
    Effect.flatMap(effect, (response) => {
      const isRetryable = response.status === 429 || otherTransientStatuses.has(response.status);
      if (!isRetryable || remaining <= 0) return Effect.succeed(response);
      return delayFor(response, attempt, options).pipe(
        Effect.flatMap(Effect.sleep),
        Effect.flatMap(() => loop(effect, remaining - 1, attempt + 1)),
      );
    });

  return HttpClient.transform(client, (effect) => loop(effect, options.maxRetries, 0));
};
