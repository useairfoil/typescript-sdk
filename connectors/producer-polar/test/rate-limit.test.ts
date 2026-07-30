import { describe, expect, it } from "@effect/vitest";
import { Metrics } from "@useairfoil/connector-kit";
import { Effect, Fiber, Layer, Metric, Option, Redacted, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/unstable/http";

import type { PolarConfig } from "../src/manifest";

import { PolarApiClient } from "../src/index";

const config: PolarConfig = {
  accessToken: Redacted.make("test-token"),
  apiBaseUrl: "https://api.polar.sh/v1",
  organizationId: Option.none(),
  rateLimitPerMinute: Option.none(),
  transientMaxRetries: 5,
  retryBaseDelayMs: 200,
  requestTimeoutSeconds: 120,
  webhookSecret: Redacted.make("test-webhook-secret"),
};

const retryCount = (reason: Metrics.ApiRetryReason) =>
  Metric.value(
    Metric.withAttributes(Metrics.apiRetriesTotal, {
      connector: "producer-polar",
      reason,
    }),
  ).pipe(Effect.map((state) => state.count));

const freshMetricRegistry = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideService(Metric.MetricRegistry, new Map()));

const runWithCountingClient = (
  status: number,
  headers?: Record<string, string>,
  configOverrides?: Partial<PolarConfig>,
) =>
  Effect.gen(function* () {
    const callCount = yield* Ref.make(0);
    const client = HttpClient.make((request) =>
      Ref.update(callCount, (n) => n + 1).pipe(
        Effect.as(
          HttpClientResponse.fromWeb(
            request,
            new Response("{}", {
              status,
              headers: { "content-type": "application/json", ...headers },
            }),
          ),
        ),
      ),
    );

    const provide = <A, E>(effect: Effect.Effect<A, E, PolarApiClient.PolarApiClient>) =>
      effect.pipe(
        Effect.provide(
          PolarApiClient.layer({ ...config, ...configOverrides }).pipe(
            Layer.provide(Layer.succeed(HttpClient.HttpClient)(client)),
          ),
        ),
      );

    return { callCount, provide };
  });

describe("producer-polar rate limiting", () => {
  it.effect("applies the request timeout while reading the response body", () =>
    Effect.gen(function* () {
      const client = HttpClient.make((request) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(new ReadableStream<Uint8Array>({ start() {} }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          ),
        ),
      );
      const effect = Effect.gen(function* () {
        const api = yield* PolarApiClient.PolarApiClient;
        return yield* api.fetchJson(Schema.Struct({}), "customers/");
      }).pipe(
        Effect.provide(
          PolarApiClient.layer({ ...config, requestTimeoutSeconds: 2 }).pipe(
            Layer.provide(Layer.succeed(HttpClient.HttpClient)(client)),
          ),
        ),
      );

      const fiber = yield* effect.pipe(Effect.exit, Effect.forkDetach);

      yield* TestClock.adjust("3 seconds");
      const exit = yield* Fiber.join(fiber);

      expect(exit._tag).toBe("Failure");
    }),
  );

  it.effect("times out instead of retrying a persistent 429 forever", () =>
    Effect.gen(function* () {
      // withRateLimiter retries 429 responses without a limit.
      // Advance past the request timeout to make sure it still stops.
      const { callCount, provide } = yield* runWithCountingClient(
        429,
        { "retry-after": "1" },
        { requestTimeoutSeconds: 2 },
      );

      const fiber = yield* provide(
        Effect.gen(function* () {
          const api = yield* PolarApiClient.PolarApiClient;
          return yield* api.fetchJson(Schema.Struct({}), "customers/");
        }),
      ).pipe(Effect.exit, Effect.forkDetach);

      for (let i = 0; i < 5; i++) {
        yield* Effect.yieldNow;
        yield* TestClock.adjust("1 second");
      }

      const exit = yield* Fiber.join(fiber);

      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(callCount)).toBeGreaterThan(1);
    }),
  );

  it.effect("counts response-channel 429 retries", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.updateAndGet(callCount, (n) => n + 1).pipe(
          Effect.map((n) =>
            HttpClientResponse.fromWeb(
              request,
              new Response("{}", {
                status: n === 1 ? 429 : 200,
                headers: { "content-type": "application/json", "retry-after": "0" },
              }),
            ),
          ),
        ),
      );

      const fiber = yield* Effect.gen(function* () {
        const api = yield* PolarApiClient.PolarApiClient;
        return yield* api.fetchJson(Schema.Struct({}), "customers/");
      }).pipe(
        Effect.provide(
          PolarApiClient.layer(config).pipe(
            Layer.provide(Layer.succeed(HttpClient.HttpClient)(client)),
          ),
        ),
        Effect.forkDetach,
      );
      yield* TestClock.adjust("1 minute");
      const result = yield* Fiber.join(fiber);

      expect(result).toEqual({});
      expect(yield* Ref.get(callCount)).toBe(2);
      expect(yield* retryCount("rate_limit")).toBe(1);
    }).pipe(freshMetricRegistry),
  );

  it.effect("counts failure-channel 429 retries once", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0);
      const client = HttpClient.make((request) =>
        Ref.updateAndGet(callCount, (n) => n + 1).pipe(
          Effect.flatMap((n) => {
            const response = HttpClientResponse.fromWeb(
              request,
              new Response("{}", {
                status: n === 1 ? 429 : 200,
                headers: { "content-type": "application/json", "retry-after": "0" },
              }),
            );
            return n === 1
              ? Effect.fail(
                  new HttpClientError.HttpClientError({
                    reason: new HttpClientError.StatusCodeError({ request, response }),
                  }),
                )
              : Effect.succeed(response);
          }),
        ),
      );

      const fiber = yield* Effect.gen(function* () {
        const api = yield* PolarApiClient.PolarApiClient;
        return yield* api.fetchJson(Schema.Struct({}), "customers/");
      }).pipe(
        Effect.provide(
          PolarApiClient.layer(config).pipe(
            Layer.provide(Layer.succeed(HttpClient.HttpClient)(client)),
          ),
        ),
        Effect.forkDetach,
      );
      yield* TestClock.adjust("1 minute");
      const result = yield* Fiber.join(fiber);

      expect(result).toEqual({});
      expect(yield* Ref.get(callCount)).toBe(2);
      expect(yield* retryCount("rate_limit")).toBe(1);
    }).pipe(freshMetricRegistry),
  );

  it.effect("succeeds without retrying when the response is ok", () =>
    Effect.gen(function* () {
      const { callCount, provide } = yield* runWithCountingClient(200);

      const result = yield* provide(
        Effect.gen(function* () {
          const api = yield* PolarApiClient.PolarApiClient;
          return yield* api.fetchJson(Schema.Struct({}), "customers/");
        }),
      );

      expect(result).toEqual({});
      expect(yield* Ref.get(callCount)).toBe(1);
    }),
  );

  it.effect("fails immediately on a non-transient status instead of retrying", () =>
    Effect.gen(function* () {
      const { callCount, provide } = yield* runWithCountingClient(404);

      const exit = yield* provide(
        Effect.gen(function* () {
          const api = yield* PolarApiClient.PolarApiClient;
          return yield* api.fetchJson(Schema.Struct({}), "customers/");
        }),
      ).pipe(Effect.exit);

      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(callCount)).toBe(1);
    }),
  );

  it.effect("uses the configured transient retry limit", () =>
    Effect.gen(function* () {
      const { callCount, provide } = yield* runWithCountingClient(500, undefined, {
        transientMaxRetries: 2,
      });

      const fiber = yield* provide(
        Effect.gen(function* () {
          const api = yield* PolarApiClient.PolarApiClient;
          return yield* api.fetchJson(Schema.Struct({}), "customers/");
        }),
      ).pipe(Effect.exit, Effect.forkDetach);

      yield* TestClock.adjust("1 minute");
      const exit = yield* Fiber.join(fiber);

      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(callCount)).toBe(3);
      expect(yield* retryCount("server_error")).toBe(2);
    }).pipe(freshMetricRegistry),
  );

  it.effect("classifies timeout and transport retries", () =>
    Effect.gen(function* () {
      const timeout = yield* runWithCountingClient(408, undefined, {
        transientMaxRetries: 1,
      });
      const timeoutFiber = yield* timeout
        .provide(
          Effect.gen(function* () {
            const api = yield* PolarApiClient.PolarApiClient;
            return yield* api.fetchJson(Schema.Struct({}), "customers/");
          }),
        )
        .pipe(Effect.exit, Effect.forkDetach);

      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(timeoutFiber);

      const transportCalls = yield* Ref.make(0);
      const transportClient = HttpClient.make((request) =>
        Ref.update(transportCalls, (n) => n + 1).pipe(
          Effect.andThen(
            Effect.fail(
              new HttpClientError.HttpClientError({
                reason: new HttpClientError.TransportError({ request }),
              }),
            ),
          ),
        ),
      );
      const transportFiber = yield* Effect.gen(function* () {
        const api = yield* PolarApiClient.PolarApiClient;
        return yield* api.fetchJson(Schema.Struct({}), "customers/");
      }).pipe(
        Effect.provide(
          PolarApiClient.layer({ ...config, transientMaxRetries: 1 }).pipe(
            Layer.provide(Layer.succeed(HttpClient.HttpClient)(transportClient)),
          ),
        ),
        Effect.exit,
        Effect.forkDetach,
      );

      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(transportFiber);

      expect(yield* retryCount("timeout")).toBe(1);
      expect(yield* retryCount("transport")).toBe(1);
    }).pipe(freshMetricRegistry),
  );

  it.effect("uses the configured request rate", () =>
    Effect.gen(function* () {
      const { callCount, provide } = yield* runWithCountingClient(200, undefined, {
        rateLimitPerMinute: Option.some(1),
      });

      const fiber = yield* provide(
        Effect.gen(function* () {
          const api = yield* PolarApiClient.PolarApiClient;
          return yield* Effect.all(
            [
              api.fetchJson(Schema.Struct({}), "customers/"),
              api.fetchJson(Schema.Struct({}), "customers/"),
            ],
            { concurrency: "unbounded" },
          );
        }),
      ).pipe(Effect.forkDetach);

      yield* Effect.yieldNow;
      expect(yield* Ref.get(callCount)).toBe(1);

      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(fiber);
      expect(yield* Ref.get(callCount)).toBe(2);
    }),
  );
});
