import { describe, expect, it } from "@effect/vitest";
import { Metrics, Telemetry } from "@useairfoil/connector-kit";
import { Array as Arr, Effect, Layer, Metric, Option, Redacted, Ref, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import type { HubSpotConfig } from "../src/manifest";

import { HubSpotClient } from "../src/index";

const config: HubSpotConfig = {
  accessToken: Redacted.make("pat-test"),
  clientSecret: Option.none(),
};

const retryCount = (reason: Metrics.ApiRetryReason) =>
  Metric.value(
    Metric.withAttributes(Metrics.apiRetries, {
      [Telemetry.Attr.connectorName]: "producer-hubspot",
      [Telemetry.Attr.apiRetryReason]: reason,
    }),
  ).pipe(Effect.map((state) => state.count));

type FakeResponse = { readonly status: number; readonly body: unknown };

/** Answers with the given responses in order, then keeps the last one. */
const getWith = (responses: Arr.NonEmptyReadonlyArray<FakeResponse>) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make(0);
    const http = HttpClient.make((request) =>
      Ref.getAndUpdate(calls, (n) => n + 1).pipe(
        Effect.map((n) => {
          const { status, body } = responses[n] ?? Arr.lastNonEmpty(responses);
          return HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(body), {
              status,
              headers: { "content-type": "application/json" },
            }),
          );
        }),
      ),
    );

    const result = yield* Effect.gen(function* () {
      const client = yield* HubSpotClient.HubSpotClient;
      return yield* client.get(Schema.Struct({ results: Schema.Array(Schema.Unknown) }), "/owners");
    }).pipe(
      Effect.match({
        onFailure: (error) => error.message,
        onSuccess: ({ body }) => `${body.results.length} results`,
      }),
      Effect.provide(
        HubSpotClient.layer(config).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient)(http))),
      ),
    );

    return {
      result,
      calls: yield* Ref.get(calls),
      serverErrorRetries: yield* retryCount("server_error"),
    };
  }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()));

describe("client", () => {
  it.live("counts only real retries and keeps HubSpot's error message", () =>
    Effect.gen(function* () {
      const ok = { status: 200, body: { results: [] } };
      expect({
        ok: yield* getWith([ok]),
        retriedOnce: yield* getWith([{ status: 503, body: {} }, ok]),
        missingScope: yield* getWith([
          { status: 403, body: { message: "This app hasn't been granted all required scopes" } },
        ]),
      }).toMatchInlineSnapshot(`
        {
          "missingScope": {
            "calls": 1,
            "result": "HubSpot API returned 403 for /owners: This app hasn't been granted all required scopes",
            "serverErrorRetries": 0,
          },
          "ok": {
            "calls": 1,
            "result": "0 results",
            "serverErrorRetries": 0,
          },
          "retriedOnce": {
            "calls": 2,
            "result": "0 results",
            "serverErrorRetries": 1,
          },
        }
      `);
    }),
  );
});
