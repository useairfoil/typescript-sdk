import { describe, expect, it } from "@effect/vitest";
import { ConnectorError, Metrics, Telemetry } from "@useairfoil/connector-kit";
import { Clock, Effect, Fiber, Layer, Metric, Option, Redacted, Ref, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import { GitHubAuth, GitHubClient } from "../src/index";

type Reply = {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
};

const now = Date.parse("2026-10-06T10:00:00.000Z");

const retryCount = (reason: Metrics.ApiRetryReason) =>
  Metric.value(
    Metric.withAttributes(Metrics.apiRetries, {
      [Telemetry.Attr.connectorName]: "producer-github",
      [Telemetry.Attr.apiRetryReason]: reason,
    }),
  ).pipe(Effect.map((state) => state.count));

/**
 * Runs one `get` against replies given in order (the last one repeats). The
 * clock is moved forward until the request ends, so retry waits pass.
 */
const getWith = (replies: ReadonlyArray<Reply>, url = "/repos/octocat/hello-world/issues") =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    // Minutes after the start at which each request was sent.
    const calls = yield* Ref.make<ReadonlyArray<number>>([]);
    const invalidated = yield* Ref.make(0);
    const http = HttpClient.make((request) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((at) =>
          Ref.getAndUpdate(calls, (current) => [...current, Math.round((at - now) / 60_000)]),
        ),
        Effect.map((previous) => {
          const reply = replies[Math.min(previous.length, replies.length - 1)] ?? { status: 500 };
          return HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(reply.body ?? []), {
              status: reply.status,
              headers: { "content-type": "application/json", ...reply.headers },
            }),
          );
        }),
      ),
    );
    const auth: GitHubAuth.GitHubAuthService = {
      get: Effect.succeed(Redacted.make("ghs_test")),
      invalidate: Ref.update(invalidated, (n) => n + 1),
    };

    const fiber = yield* Effect.gen(function* () {
      const client = yield* GitHubClient.GitHubClient;
      return yield* client.get(Schema.Array(Schema.Number), url);
    }).pipe(
      Effect.provide(
        Layer.effect(GitHubClient.GitHubClient)(GitHubClient.make()).pipe(
          Layer.provide(Layer.succeed(HttpClient.HttpClient)(http)),
          Layer.provide(Layer.succeed(GitHubAuth.GitHubAuth)(auth)),
        ),
      ),
      Effect.match({
        onFailure: (error: ConnectorError) => ({ error: error.message }),
        onSuccess: (page) => ({
          body: page.body,
          next: Option.getOrNull(page.next),
        }),
      }),
      Effect.forkChild,
    );
    // Long enough for an hourly reset plus every backoff.
    yield* TestClock.adjust("3 hours");
    const result = yield* Fiber.join(fiber);

    return {
      result,
      calls: yield* Ref.get(calls),
      invalidated: yield* Ref.get(invalidated),
      rateLimitRetries: yield* retryCount("rate_limit"),
      serverErrorRetries: yield* retryCount("server_error"),
    };
  }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()));

describe("client", () => {
  it.effect("returns the next link and retries server errors", () =>
    Effect.gen(function* () {
      const next =
        "https://api.github.com/repositories/1/issues?per_page=100&after=Y3Vyc29y&page=2";
      expect({
        ok: yield* getWith([
          {
            status: 200,
            body: [1, 2],
            headers: {
              link: `<${next}>; rel="next", <https://api.github.com/x?page=9>; rel="last"`,
            },
          },
        ]),
        retried: yield* getWith([{ status: 502 }, { status: 200, body: [3] }]),
      }).toMatchInlineSnapshot(`
        {
          "ok": {
            "calls": [
              0,
            ],
            "invalidated": 0,
            "rateLimitRetries": 0,
            "result": {
              "body": [
                1,
                2,
              ],
              "next": "https://api.github.com/repositories/1/issues?per_page=100&after=Y3Vyc29y&page=2",
            },
            "serverErrorRetries": 0,
          },
          "retried": {
            "calls": [
              0,
              0,
            ],
            "invalidated": 0,
            "rateLimitRetries": 0,
            "result": {
              "body": [
                3,
              ],
              "next": null,
            },
            "serverErrorRetries": 1,
          },
        }
      `);
    }),
  );

  it.effect("waits for rate limits and fails on permission errors", () =>
    Effect.gen(function* () {
      const resetIn40Minutes = String(Math.floor(now / 1000) + 40 * 60);
      expect({
        primary: yield* getWith([
          {
            status: 403,
            body: { message: "API rate limit exceeded for installation ID 1." },
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": resetIn40Minutes,
            },
          },
          { status: 200, body: [] },
        ]),
        retryAfter: yield* getWith([
          { status: 429, headers: { "retry-after": "120" } },
          { status: 200, body: [] },
        ]),
        secondary: yield* getWith([
          {
            status: 403,
            body: { message: "You have exceeded a secondary rate limit." },
          },
          { status: 200, body: [] },
        ]),
        permission: yield* getWith([
          {
            status: 403,
            body: { message: "Resource not accessible by integration" },
          },
        ]),
      }).toMatchInlineSnapshot(`
        {
          "permission": {
            "calls": [
              0,
            ],
            "invalidated": 0,
            "rateLimitRetries": 0,
            "result": {
              "error": "GitHub API returned 403 for /repos/octocat/hello-world/issues: Resource not accessible by integration",
            },
            "serverErrorRetries": 0,
          },
          "primary": {
            "calls": [
              0,
              40,
            ],
            "invalidated": 0,
            "rateLimitRetries": 1,
            "result": {
              "body": [],
              "next": null,
            },
            "serverErrorRetries": 0,
          },
          "retryAfter": {
            "calls": [
              0,
              2,
            ],
            "invalidated": 0,
            "rateLimitRetries": 1,
            "result": {
              "body": [],
              "next": null,
            },
            "serverErrorRetries": 0,
          },
          "secondary": {
            "calls": [
              0,
              1,
            ],
            "invalidated": 0,
            "rateLimitRetries": 1,
            "result": {
              "body": [],
              "next": null,
            },
            "serverErrorRetries": 0,
          },
        }
      `);
    }),
  );

  it.effect("retries once with a new token after 401 and never sends it to another host", () =>
    Effect.gen(function* () {
      const badCredentials = { status: 401, body: { message: "Bad credentials" } };
      expect({
        newToken: yield* getWith([badCredentials, { status: 200, body: [1] }]),
        stillUnauthorized: yield* getWith([badCredentials]),
        otherHost: yield* getWith([{ status: 200 }], "https://example.com/repos/o/r/issues"),
      }).toMatchInlineSnapshot(`
        {
          "newToken": {
            "calls": [
              0,
              0,
            ],
            "invalidated": 1,
            "rateLimitRetries": 0,
            "result": {
              "body": [
                1,
              ],
              "next": null,
            },
            "serverErrorRetries": 0,
          },
          "otherHost": {
            "calls": [],
            "invalidated": 0,
            "rateLimitRetries": 0,
            "result": {
              "error": "Not a GitHub API URL: https://example.com/repos/o/r/issues",
            },
            "serverErrorRetries": 0,
          },
          "stillUnauthorized": {
            "calls": [
              0,
              0,
            ],
            "invalidated": 1,
            "rateLimitRetries": 0,
            "result": {
              "error": "GitHub API returned 401 for /repos/octocat/hello-world/issues: Bad credentials",
            },
            "serverErrorRetries": 0,
          },
        }
      `);
    }),
  );
});
