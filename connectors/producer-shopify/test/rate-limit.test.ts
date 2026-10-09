import { describe, expect, it } from "@effect/vitest";
import { Metrics, Telemetry } from "@useairfoil/connector-kit";
import { Effect, Fiber, Metric, Redacted, Ref, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import type { ShopifyConfig } from "../src/manifest";

import * as ShopifyAuth from "../src/api/auth";
import { ShopifyApiClient } from "../src/index";

const config: ShopifyConfig = {
  shopDomain: "your-development-store.myshopify.com",
  clientId: "test-client-id",
  clientSecret: Redacted.make("test-client-secret"),
  webhookSecret: Redacted.make("test-webhook-secret"),
};

const authService: ShopifyAuth.ShopifyAuthService = {
  get: Effect.succeed(Redacted.make("test-token")),
  invalidate: Effect.void,
};

const retryCount = (reason: Metrics.ApiRetryReason) =>
  Metric.value(
    Metric.withAttributes(Metrics.apiRetries, {
      [Telemetry.Attr.connectorName]: "producer-shopify",
      [Telemetry.Attr.apiRetryReason]: reason,
    }),
  ).pipe(Effect.map((state) => state.count));

const freshMetricRegistry = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideService(Metric.MetricRegistry, new Map()));

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
      expect(yield* retryCount("rate_limit")).toBe(1);
    }).pipe(freshMetricRegistry),
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
      expect(yield* retryCount("rate_limit")).toBe(1);
    }).pipe(freshMetricRegistry),
  );

  it.effect("retries INTERNAL_SERVER_ERROR 5 times, then fails", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.update(callCount, (n) => n + 1).pipe(
          Effect.as(jsonResponse(request, internalErrorBody())),
        ),
      );

      const api = yield* ShopifyApiClient.make(config).pipe(
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
      expect(count).toBe(6);
      expect(yield* retryCount("server_error")).toBe(5);
    }).pipe(freshMetricRegistry),
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

  it.effect("gives up on a persistent HTTP 429 after 5 retries", () =>
    Effect.gen(function* () {
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

      const api = yield* ShopifyApiClient.make(config).pipe(
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
      expect(yield* Ref.get(callCount)).toBe(6);
      expect(yield* retryCount("rate_limit")).toBe(5);
    }).pipe(freshMetricRegistry),
  );
});
