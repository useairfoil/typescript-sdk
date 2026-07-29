import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Fiber, Redacted, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/unstable/http";

import type { ShopifyConfig } from "../src/manifest";

import * as ShopifyAuth from "../src/auth";
import { ShopifyApiClient } from "../src/index";
import * as Throttle from "../src/throttle";

const config: ShopifyConfig = {
  shopDomain: "your-development-store.myshopify.com",
  apiVersion: "2026-07",
  clientId: "test-client-id",
  clientSecret: Redacted.make("test-client-secret"),
  responseMaxRetries: 5,
  transportMaxRetries: 5,
  graphqlMaxRetries: 5,
  retryBaseDelayMs: 200,
  graphqlRetryBaseDelayMs: 500,
  retryAfterFallbackSeconds: 1,
  requestTimeoutSeconds: 120,
  webhookSecret: Redacted.make("test-webhook-secret"),
};

const authService: ShopifyAuth.ShopifyAuthService = {
  get: Effect.succeed(Redacted.make("test-token")),
  invalidate: Effect.void,
};

const shopIdSchema = Schema.Struct({ shop: Schema.Struct({ id: Schema.String }) });

const jsonResponse = (request: HttpClientResponse.HttpClientResponse["request"], body: unknown) =>
  HttpClientResponse.fromWeb(
    request,
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

const throttledBody = (
  requestedQueryCost: number,
  currentlyAvailable: number,
  restoreRate = 1000,
) => ({
  errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
  extensions: {
    cost: {
      requestedQueryCost,
      actualQueryCost: null,
      throttleStatus: { maximumAvailable: 1000, currentlyAvailable, restoreRate },
    },
  },
});

const successBody = (requestedQueryCost: number, currentlyAvailable: number) => ({
  data: { shop: { id: "gid://shopify/Shop/1" } },
  extensions: {
    cost: {
      requestedQueryCost,
      actualQueryCost: requestedQueryCost,
      throttleStatus: { maximumAvailable: 1000, currentlyAvailable, restoreRate: 1000 },
    },
  },
});

const internalErrorBody = () => ({
  errors: [{ message: "Internal error", extensions: { code: "INTERNAL_SERVER_ERROR" } }],
});

const accessDeniedBody = () => ({
  errors: [{ message: "Access denied", extensions: { code: "ACCESS_DENIED" } }],
});

describe("producer-shopify rate limiting", () => {
  it.effect("waits at least the base delay when Shopify reports no cost deficit", () =>
    Effect.gen(function* () {
      const delay = yield* Throttle.retryDelay("THROTTLED", throttledBody(1, 100), 0, {
        baseDelay: Duration.millis(config.graphqlRetryBaseDelayMs),
      });

      expect(Duration.toMillis(delay)).toBe(config.graphqlRetryBaseDelayMs);
    }),
  );

  it.effect("falls back to backoff when the reported restore rate is not positive", () =>
    Effect.gen(function* () {
      const delay = yield* Throttle.retryDelay("THROTTLED", throttledBody(50, 10, 0), 0, {
        baseDelay: Duration.millis(config.graphqlRetryBaseDelayMs),
      });
      const delayMillis = Duration.toMillis(delay);

      expect(Number.isFinite(delayMillis)).toBe(true);
      expect(delayMillis).toBeGreaterThan(0);
    }),
  );

  it.effect("waits for the full Retry-After delay before retrying an HTTP 429", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.updateAndGet(callCount, (n) => n + 1).pipe(
          Effect.map((n) =>
            n === 1
              ? HttpClientResponse.fromWeb(
                  request,
                  new Response("{}", {
                    status: 429,
                    headers: { "content-type": "application/json", "retry-after": "5" },
                  }),
                )
              : jsonResponse(request, successBody(1, 999)),
          ),
        ),
      );
      const api = yield* ShopifyApiClient.make({
        ...config,
        responseMaxRetries: 1,
        requestTimeoutSeconds: 10,
      }).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, authService),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      const fiber = yield* api
        .fetchGraphQL({
          operationName: "Test",
          query: "query { shop { id } }",
          schema: shopIdSchema,
        })
        .pipe(Effect.forkDetach);

      yield* Effect.yieldNow;
      expect(yield* Ref.get(callCount)).toBe(1);

      yield* TestClock.adjust("4 seconds");
      expect(yield* Ref.get(callCount)).toBe(1);

      yield* TestClock.adjust("1 second");
      const result = yield* Fiber.join(fiber);

      expect(result).toEqual({ shop: { id: "gid://shopify/Shop/1" } });
      expect(yield* Ref.get(callCount)).toBe(2);
    }),
  );

  it.effect("retries a THROTTLED response and succeeds once budget is reported available", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.updateAndGet(callCount, (n) => n + 1).pipe(
          Effect.map((n) =>
            jsonResponse(request, n === 1 ? throttledBody(50, 10) : successBody(50, 950)),
          ),
        ),
      );

      const api = yield* ShopifyApiClient.make(config).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, authService),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      const fiber = yield* Effect.forkDetach(
        api.fetchGraphQL({
          operationName: "Test",
          query: "query { shop { id } }",
          schema: shopIdSchema,
        }),
      );
      // Advance past the wait calculated from the reported cost deficit.
      yield* TestClock.adjust("1 second");
      const result = yield* Fiber.join(fiber);

      expect(result).toEqual({ shop: { id: "gid://shopify/Shop/1" } });
      expect(yield* Ref.get(callCount)).toBe(2);
    }),
  );

  it.effect("retries a bounded number of times on INTERNAL_SERVER_ERROR, then fails", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.update(callCount, (n) => n + 1).pipe(
          Effect.as(jsonResponse(request, internalErrorBody())),
        ),
      );

      const api = yield* ShopifyApiClient.make({ ...config, graphqlMaxRetries: 2 }).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, authService),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      const fiber = yield* Effect.forkDetach(
        Effect.exit(
          api.fetchGraphQL({
            operationName: "Test",
            query: "query { shop { id } }",
            schema: shopIdSchema,
          }),
        ),
      );
      // Advance past the longest jittered backoff.
      yield* TestClock.adjust("1 minute");
      const exit = yield* Fiber.join(fiber);

      expect(exit._tag).toBe("Failure");
      const count = yield* Ref.get(callCount);
      expect(count).toBe(3);
    }),
  );

  it.effect("does not retry a non-retryable GraphQL error", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.update(callCount, (n) => n + 1).pipe(
          Effect.as(jsonResponse(request, accessDeniedBody())),
        ),
      );

      const api = yield* ShopifyApiClient.make(config).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, authService),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      const exit = yield* Effect.exit(
        api.fetchGraphQL({
          operationName: "Test",
          query: "query { shop { id } }",
          schema: shopIdSchema,
        }),
      );

      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(callCount)).toBe(1);
    }),
  );

  it.effect("does not retry when a retryable error shows up alongside a non-retryable one", () =>
    Effect.gen(function* () {
      // A permanent error makes the full response unsafe to retry.
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.update(callCount, (n) => n + 1).pipe(
          Effect.as(
            jsonResponse(request, {
              errors: [
                { message: "Throttled", extensions: { code: "THROTTLED" } },
                { message: "Access denied", extensions: { code: "ACCESS_DENIED" } },
              ],
            }),
          ),
        ),
      );

      const api = yield* ShopifyApiClient.make(config).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, authService),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      const exit = yield* Effect.exit(
        api.fetchGraphQL({
          operationName: "Test",
          query: "query { shop { id } }",
          schema: shopIdSchema,
        }),
      );

      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(callCount)).toBe(1);
    }),
  );

  it.effect("bounds a persistent HTTP 429 to one retry budget, not two multiplying ones", () =>
    Effect.gen(function* () {
      // The transport retry policy must not retry HTTP responses again.
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.updateAndGet(callCount, (n) => n + 1).pipe(
          Effect.map(() =>
            HttpClientResponse.fromWeb(
              request,
              new Response("{}", { status: 429, headers: { "retry-after": "1" } }),
            ),
          ),
        ),
      );

      const api = yield* ShopifyApiClient.make({ ...config, responseMaxRetries: 2 }).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, authService),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      const fiber = yield* Effect.forkDetach(
        Effect.exit(
          api.fetchGraphQL({
            operationName: "Test",
            query: "query { shop { id } }",
            schema: shopIdSchema,
          }),
        ),
      );
      yield* TestClock.adjust("1 minute");
      const exit = yield* Fiber.join(fiber);

      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(callCount)).toBe(3);
    }),
  );

  it.effect("uses the configured transport retry limit", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.update(callCount, (n) => n + 1).pipe(
          Effect.andThen(
            Effect.fail(
              new HttpClientError.HttpClientError({
                reason: new HttpClientError.TransportError({ request }),
              }),
            ),
          ),
        ),
      );

      const api = yield* ShopifyApiClient.make({ ...config, transportMaxRetries: 2 }).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, authService),
        Effect.provideService(HttpClient.HttpClient, client),
      );
      const fiber = yield* api
        .fetchGraphQL({
          operationName: "Test",
          query: "query { shop { id } }",
          schema: shopIdSchema,
        })
        .pipe(Effect.exit, Effect.forkDetach);

      yield* TestClock.adjust("1 minute");
      const exit = yield* Fiber.join(fiber);

      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(callCount)).toBe(3);
    }),
  );
});
