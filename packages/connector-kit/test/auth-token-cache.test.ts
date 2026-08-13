import { describe, expect, it } from "@effect/vitest";
import { Context, Data, Deferred, Duration, Effect, Fiber, Layer, Redacted, Ref } from "effect";
import { TestClock } from "effect/testing";

import * as Auth from "../src/auth";

class AcquireError extends Data.TaggedError("AcquireError") {}

class TokenIssuer extends Context.Service<
  TokenIssuer,
  { readonly acquire: Effect.Effect<Auth.ExpiringToken> }
>()("TokenIssuer") {}

const token = (value: string, expiresIn = Duration.seconds(10)): Auth.ExpiringToken => ({
  value: Redacted.make(value),
  expiresIn,
});

const valueOf = (value: Redacted.Redacted<string>): string => Redacted.value(value);

describe("Auth.makeTokenCache", () => {
  it.effect("acquires once and reuses the token before half-life", () =>
    Effect.gen(function* () {
      const acquisitions = yield* Ref.make(0);
      const cache = yield* Auth.makeTokenCache({
        acquire: Ref.updateAndGet(acquisitions, (count) => count + 1).pipe(
          Effect.map((count) => token(`token-${count}`)),
        ),
      });

      expect(valueOf(yield* cache.get)).toBe("token-1");
      yield* TestClock.adjust("4999 millis");
      expect(valueOf(yield* cache.get)).toBe("token-1");
      expect(yield* Ref.get(acquisitions)).toBe(1);
    }),
  );

  it.effect("shares one acquisition between concurrent callers", () =>
    Effect.gen(function* () {
      const acquisitions = yield* Ref.make(0);
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const cache = yield* Auth.makeTokenCache({
        acquire: Effect.gen(function* () {
          yield* Ref.update(acquisitions, (count) => count + 1);
          yield* Deferred.succeed(started, undefined);
          yield* Deferred.await(release);
          return token("shared-token");
        }),
      });

      const fiber = yield* Effect.all([cache.get, cache.get, cache.get], {
        concurrency: "unbounded",
      }).pipe(Effect.forkChild);
      yield* Deferred.await(started);

      expect(yield* Ref.get(acquisitions)).toBe(1);
      yield* Deferred.succeed(release, undefined);
      expect((yield* Fiber.join(fiber)).map(valueOf)).toEqual([
        "shared-token",
        "shared-token",
        "shared-token",
      ]);
    }),
  );

  it.effect("reacquires on the first get after half-life", () =>
    Effect.gen(function* () {
      const acquisitions = yield* Ref.make(0);
      const cache = yield* Auth.makeTokenCache({
        acquire: Ref.updateAndGet(acquisitions, (count) => count + 1).pipe(
          Effect.map((count) => token(`token-${count}`)),
        ),
      });

      expect(valueOf(yield* cache.get)).toBe("token-1");
      yield* TestClock.adjust("5 seconds");
      expect(valueOf(yield* cache.get)).toBe("token-2");
      expect(yield* Ref.get(acquisitions)).toBe(2);
    }),
  );

  it.effect("clamps the refresh factor between zero and one", () =>
    Effect.gen(function* () {
      const acquisitions = yield* Ref.make(0);
      const acquire = Ref.updateAndGet(acquisitions, (count) => count + 1).pipe(
        Effect.map((count) => token(`token-${count}`)),
      );
      const immediatelyStale = yield* Auth.makeTokenCache({
        acquire,
        refreshFactor: -1,
      });

      expect(valueOf(yield* immediatelyStale.get)).toBe("token-1");
      expect(valueOf(yield* immediatelyStale.get)).toBe("token-2");

      const fullLifetime = yield* Auth.makeTokenCache({
        acquire,
        refreshFactor: 2,
      });

      expect(valueOf(yield* fullLifetime.get)).toBe("token-3");
      yield* TestClock.adjust("9999 millis");
      expect(valueOf(yield* fullLifetime.get)).toBe("token-3");
      yield* TestClock.adjust("1 millis");
      expect(valueOf(yield* fullLifetime.get)).toBe("token-4");
    }),
  );

  it.effect("does not cache failed acquisitions", () =>
    Effect.gen(function* () {
      const acquisitions = yield* Ref.make(0);
      const cache = yield* Auth.makeTokenCache({
        acquire: Ref.updateAndGet(acquisitions, (count) => count + 1).pipe(
          Effect.flatMap((count) =>
            count === 1
              ? Effect.fail(new AcquireError())
              : Effect.succeed(token("recovered-token")),
          ),
        ),
      });

      expect((yield* Effect.exit(cache.get))._tag).toBe("Failure");
      expect(valueOf(yield* cache.get)).toBe("recovered-token");
      expect(yield* Ref.get(acquisitions)).toBe(2);
    }),
  );

  it.effect("reacquires after explicit invalidation", () =>
    Effect.gen(function* () {
      const acquisitions = yield* Ref.make(0);
      const cache = yield* Auth.makeTokenCache({
        acquire: Ref.updateAndGet(acquisitions, (count) => count + 1).pipe(
          Effect.map((count) => token(`token-${count}`)),
        ),
      });

      expect(valueOf(yield* cache.get)).toBe("token-1");
      yield* cache.invalidate;
      expect(valueOf(yield* cache.get)).toBe("token-2");
    }),
  );

  it.effect("captures acquisition services when the cache is constructed", () =>
    Effect.gen(function* () {
      const cache: Auth.TokenCache<never> = yield* Auth.makeTokenCache({
        acquire: TokenIssuer.use((issuer) => issuer.acquire),
      });

      expect(valueOf(yield* cache.get)).toBe("service-token");
    }).pipe(
      Effect.provide(
        Layer.succeed(TokenIssuer)({
          acquire: Effect.succeed(token("service-token")),
        }),
      ),
    ),
  );
});
