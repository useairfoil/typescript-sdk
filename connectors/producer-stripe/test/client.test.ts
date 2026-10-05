import { describe, expect, it } from "@effect/vitest";
import { Metrics, Telemetry } from "@useairfoil/connector-kit";
import { Effect, Layer, Metric, Redacted, Ref, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import type { StripeConfig } from "../src/manifest";

import { StripeClient } from "../src/index";

const config: StripeConfig = {
  apiKey: Redacted.make("rk_test_fake"),
  webhookSecret: Redacted.make("whsec_test"),
  rateLimitPerSecond: 20,
};

const retryCount = (reason: Metrics.ApiRetryReason) =>
  Metric.value(
    Metric.withAttributes(Metrics.apiRetries, {
      [Telemetry.Attr.connectorName]: "producer-stripe",
      [Telemetry.Attr.apiRetryReason]: reason,
    }),
  ).pipe(Effect.map((state) => state.count));

/** Answers with the given statuses in order, then keeps the last one. */
const listWith = (statuses: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make(0);
    const http = HttpClient.make((request) =>
      Ref.getAndUpdate(calls, (n) => n + 1).pipe(
        Effect.map((n) =>
          HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify({ data: [], has_more: false }), {
              status: statuses[Math.min(n, statuses.length - 1)],
              headers: { "content-type": "application/json" },
            }),
          ),
        ),
      ),
    );

    const page = yield* Effect.gen(function* () {
      const client = yield* StripeClient.StripeClient;
      return yield* client.list(Schema.String, "customers", [["limit", "1"]]);
    }).pipe(
      Effect.provide(
        StripeClient.layer(config).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient)(http))),
      ),
    );

    return {
      items: page.items.length,
      calls: yield* Ref.get(calls),
      serverErrorRetries: yield* retryCount("server_error"),
    };
  }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()));

describe("client", () => {
  it.live("counts only real retries", () =>
    Effect.gen(function* () {
      expect({
        ok: yield* listWith([200]),
        retriedOnce: yield* listWith([503, 200]),
      }).toMatchInlineSnapshot(`
        {
          "ok": {
            "calls": 1,
            "items": 0,
            "serverErrorRetries": 0,
          },
          "retriedOnce": {
            "calls": 2,
            "items": 0,
            "serverErrorRetries": 1,
          },
        }
      `);
    }),
  );
});
