import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Fiber, Layer, Metric, Redacted, Ref, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import type { SalesforceConfig } from "../src/manifest";

import { SalesforceClient } from "../src/index";

const config: SalesforceConfig = {
  domain: "acme.my.salesforce.com",
  clientId: "client-id",
  clientSecret: Redacted.make("client-secret"),
};

type FakeResponse = { readonly status: number; readonly body: unknown };

/** Answers API calls with the given responses in order, then keeps the last one. */
const getWith = (responses: Arr.NonEmptyReadonlyArray<FakeResponse>) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<ReadonlyArray<string>>([]);
    const http = HttpClient.make((request) =>
      Effect.gen(function* () {
        const sent = yield* Ref.updateAndGet(calls, (list) => [
          ...list,
          `${request.method} ${request.url} ${request.headers.authorization ?? ""} ${
            request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : ""
          }`.trim(),
        ]);
        const isToken = request.url.endsWith("/services/oauth2/token");
        const apiCalls = sent.filter((call) => !call.includes("/oauth2/token")).length;
        const { status, body } = isToken
          ? { status: 200, body: { access_token: "token-1", instance_url: "https://x" } }
          : (responses[apiCalls - 1] ?? Arr.lastNonEmpty(responses));
        return HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          }),
        );
      }),
    );

    const result = yield* Effect.gen(function* () {
      const client = yield* SalesforceClient.SalesforceClient;
      return yield* client.get(
        Schema.Struct({ sobjects: Schema.Array(Schema.Unknown) }),
        "/sobjects",
      );
    }).pipe(
      Effect.match({
        onFailure: (error) => error.message,
        onSuccess: ({ body }) => `${body.sobjects.length} objects`,
      }),
      Effect.provide(
        SalesforceClient.layer(config).pipe(
          Layer.provide(Layer.succeed(HttpClient.HttpClient)(http)),
        ),
      ),
    );

    return { result, calls: yield* Ref.get(calls) };
  }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()));

describe("client", () => {
  it.live("gets a token with Basic auth and retries server errors", () =>
    Effect.gen(function* () {
      const ok = { status: 200, body: { sobjects: [] } };
      expect({
        ok: yield* getWith([ok]),
        retriedOnce: yield* getWith([{ status: 503, body: [] }, ok]),
      }).toMatchInlineSnapshot(`
        {
          "ok": {
            "calls": [
              "POST https://acme.my.salesforce.com/services/oauth2/token Basic Y2xpZW50LWlkOmNsaWVudC1zZWNyZXQ= grant_type=client_credentials",
              "GET https://acme.my.salesforce.com/services/data/v68.0/sobjects Bearer token-1",
            ],
            "result": "0 objects",
          },
          "retriedOnce": {
            "calls": [
              "POST https://acme.my.salesforce.com/services/oauth2/token Basic Y2xpZW50LWlkOmNsaWVudC1zZWNyZXQ= grant_type=client_credentials",
              "GET https://acme.my.salesforce.com/services/data/v68.0/sobjects Bearer token-1",
              "GET https://acme.my.salesforce.com/services/data/v68.0/sobjects Bearer token-1",
            ],
            "result": "0 objects",
          },
        }
      `);
    }),
  );

  it.effect("waits and tries again when the org's API limit is used up", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        getWith([
          {
            status: 403,
            body: [
              { message: "TotalRequests Limit exceeded.", errorCode: "REQUEST_LIMIT_EXCEEDED" },
            ],
          },
          { status: 200, body: { sobjects: [] } },
        ]),
      );
      yield* TestClock.adjust("1 minute");
      const { result, calls } = yield* Fiber.join(fiber);
      expect({ result, apiCalls: calls.filter((call) => call.startsWith("GET")).length })
        .toMatchInlineSnapshot(`
          {
            "apiCalls": 2,
            "result": "0 objects",
          }
        `);
    }),
  );
});
