import { Cache, Duration, Effect, Exit, Number, Redacted } from "effect";

export interface ExpiringToken {
  /** The credential kept in memory by the cache. */
  readonly value: Redacted.Redacted<string>;
  /** The lifetime reported by the provider. */
  readonly expiresIn: Duration.Duration;
}

export interface TokenCache<E> {
  /** Returns the cached token or performs one shared acquisition. */
  readonly get: Effect.Effect<Redacted.Redacted<string>, E>;
  /** Removes the cached token so the next `get` reacquires it. */
  readonly invalidate: Effect.Effect<void>;
}

/**
 * Creates a lazy, in-memory token cache around an acquisition effect.
 *
 * `refreshFactor` controls how much of the provider lifetime is cached. It is
 * clamped between `0` and `1`.
 *
 * @example
 * ```ts
 * const cache = yield* makeTokenCache({
 *   acquire: exchangeCredentials,
 *   refreshFactor: 0.5,
 * })
 *
 * const token = yield* cache.get
 * ```
 */
export const makeTokenCache = <E, R>(options: {
  readonly acquire: Effect.Effect<ExpiringToken, E, R>;
  readonly refreshFactor?: number;
}): Effect.Effect<TokenCache<E>, never, R> =>
  Effect.gen(function* () {
    const refreshFactor = Number.clamp(options.refreshFactor ?? 0.5, {
      minimum: 0,
      maximum: 1,
    });
    const cache = yield* Cache.makeWith((_: void) => options.acquire, {
      capacity: 1,
      timeToLive: (exit) =>
        Exit.isSuccess(exit)
          ? Duration.millis(Duration.toMillis(exit.value.expiresIn) * refreshFactor)
          : Duration.zero,
    });

    return {
      get: Cache.get(cache, undefined).pipe(Effect.map((token) => token.value)),
      invalidate: Cache.invalidate(cache, undefined),
    };
  });
