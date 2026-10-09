import { describe, expect, it } from "@effect/vitest";
import { Metrics, Telemetry } from "@useairfoil/connector-kit";
import { Array as Arr, Effect, Fiber, Layer, Metric, Redacted, Ref, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import type { ZendeskConfig } from "../src/manifest";

import { ZendeskClient } from "../src/index";

const config: ZendeskConfig = {
  subdomain: "acme",
  clientId: "airfoil-test",
  clientSecret: Redacted.make("secret"),
};

const retryCount = (reason: Metrics.ApiRetryReason) =>
  Metric.value(
    Metric.withAttributes(Metrics.apiRetries, {
      [Telemetry.Attr.connectorName]: "producer-zendesk",
      [Telemetry.Attr.apiRetryReason]: reason,
    }),
  ).pipe(Effect.map((state) => state.count));

type FakeResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
};

const token = { access_token: "token", token_type: "bearer", expires_in: 1800 };

const getWith = (responses: Arr.NonEmptyReadonlyArray<FakeResponse>) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<ReadonlyArray<string>>([]);
    const http = HttpClient.make((request) =>
      Ref.getAndUpdate(calls, (items) => [...items, request.url]).pipe(
        Effect.map((items) => {
          const apiCalls = items.filter((url) => !url.endsWith("/oauth/tokens")).length;
          const { status, body, headers } = request.url.endsWith("/oauth/tokens")
            ? { status: 200, body: token, headers: {} }
            : (responses[apiCalls] ?? Arr.lastNonEmpty(responses));
          return HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(body), {
              status,
              headers: { "content-type": "application/json", ...headers },
            }),
          );
        }),
      ),
    );

    const result = yield* Effect.gen(function* () {
      const client = yield* ZendeskClient.ZendeskClient;
      const schema = Schema.Struct({ groups: Schema.Array(Schema.Unknown) });
      yield* client.get(schema, "/groups").pipe(Effect.ignore);
      return yield* client.get(schema, "/groups");
    }).pipe(
      Effect.match({
        onFailure: (error) => error.message,
        onSuccess: (body) => `${body.groups.length} groups`,
      }),
      Effect.provide(
        ZendeskClient.layer(config).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient)(http))),
      ),
    );

    return {
      result,
      calls: (yield* Ref.get(calls)).map((url) => new URL(url).pathname),
      rateLimitRetries: yield* retryCount("rate_limit"),
      serverErrorRetries: yield* retryCount("server_error"),
    };
  }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()));

describe("client", () => {
  it.live("reuses the token, retries what is temporary, and keeps Zendesk's message", () =>
    Effect.gen(function* () {
      const ok = { status: 200, body: { groups: [] } };
      expect({
        ok: yield* getWith([ok]),
        retried: yield* getWith([
          { status: 503, body: {} },
          { status: 429, body: {}, headers: { "retry-after": "0" } },
          ok,
        ]),
        revoked: yield* getWith([{ status: 401, body: {} }, ok]),
        missingScope: yield* getWith([
          {
            status: 403,
            body: {
              error: "Forbidden",
              description: "You are missing the following required scopes: groups:read",
            },
          },
        ]),
      }).toMatchInlineSnapshot(`
        {
          "missingScope": {
            "calls": [
              "/oauth/tokens",
              "/api/v2/groups",
              "/api/v2/groups",
            ],
            "rateLimitRetries": 0,
            "result": "Zendesk API returned 403 for /groups: You are missing the following required scopes: groups:read",
            "serverErrorRetries": 0,
          },
          "ok": {
            "calls": [
              "/oauth/tokens",
              "/api/v2/groups",
              "/api/v2/groups",
            ],
            "rateLimitRetries": 0,
            "result": "0 groups",
            "serverErrorRetries": 0,
          },
          "retried": {
            "calls": [
              "/oauth/tokens",
              "/api/v2/groups",
              "/api/v2/groups",
              "/api/v2/groups",
              "/api/v2/groups",
            ],
            "rateLimitRetries": 1,
            "result": "0 groups",
            "serverErrorRetries": 1,
          },
          "revoked": {
            "calls": [
              "/oauth/tokens",
              "/api/v2/groups",
              "/oauth/tokens",
              "/api/v2/groups",
              "/api/v2/groups",
            ],
            "rateLimitRetries": 0,
            "result": "0 groups",
            "serverErrorRetries": 0,
          },
        }
      `);
    }),
  );

  it.effect("retries an attempt that hangs", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(0);
      const respond = (request: HttpClientRequest.HttpClientRequest, body: unknown) =>
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
        );
      const http = HttpClient.make((request) =>
        request.url.endsWith("/oauth/tokens")
          ? Effect.succeed(respond(request, token))
          : Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.flatMap((n) =>
                n === 0 ? Effect.never : Effect.succeed(respond(request, { groups: [] })),
              ),
            ),
      );

      const fiber = yield* Effect.gen(function* () {
        const client = yield* ZendeskClient.ZendeskClient;
        return yield* client.get(
          Schema.Struct({ groups: Schema.Array(Schema.Unknown) }),
          "/groups",
        );
      }).pipe(
        Effect.provide(
          ZendeskClient.layer(config).pipe(
            Layer.provide(Layer.succeed(HttpClient.HttpClient)(http)),
          ),
        ),
        Effect.forkChild,
      );
      yield* TestClock.adjust("2 minutes");
      yield* TestClock.adjust("10 seconds");

      expect({
        result: yield* Fiber.join(fiber),
        calls: yield* Ref.get(calls),
        timeoutRetries: yield* retryCount("timeout"),
      }).toMatchInlineSnapshot(`
        {
          "calls": 2,
          "result": {
            "groups": [],
          },
          "timeoutRetries": 1,
        }
      `);
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map())),
  );
});
