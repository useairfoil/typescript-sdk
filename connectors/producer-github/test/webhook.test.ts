import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Ingestion, StateStore } from "@useairfoil/connector-kit";
import { DateTime, Deferred, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { TestClock } from "effect/testing";

import { GitHubConnector, webhookPath } from "../src/index";
import {
  event,
  issue,
  issueComment,
  otherRepository,
  pullRequest,
  repository,
} from "./fixtures/objects";
import { connectorLayer, makeFakeClient, makeTestIngestor, signPayload, without } from "./helpers";

const now = Date.parse("2026-10-06T12:00:00.000Z");

/** Posts a delivery to the webhook route and waits for `expected` ingests. */
const post = (
  eventName: string,
  body: unknown,
  options: { readonly signature?: string | null; readonly expected?: number } = {},
) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    // An installation without repositories, so backfill and changes stay quiet.
    const { client } = yield* makeFakeClient((url) =>
      url.startsWith("/installation/repositories")
        ? { body: { total_count: 0, repositories: [] } }
        : undefined,
    );
    const connector = yield* GitHubConnector.GitHubConnector.pipe(
      Effect.provide(connectorLayer(client)),
    );
    const expected = options.expected ?? 0;
    const { ingestedRef, done, layer } = yield* makeTestIngestor(expected);
    const cutoff = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

    return yield* Effect.gen(function* () {
      yield* Effect.forkScoped(
        Ingestion.run(connector, {
          initialCutoff: cutoff,
          webhook: { routes: connector.webhooks ?? [] },
        }),
      );

      const rawBody = JSON.stringify(body);
      const signature = options.signature === undefined ? signPayload(rawBody) : options.signature;
      const http = yield* HttpClient.HttpClient;
      const response = yield* http.execute(
        HttpClientRequest.post(webhookPath).pipe(
          HttpClientRequest.setHeaders({
            "x-github-event": eventName,
            ...(signature === null ? {} : { "x-hub-signature-256": signature }),
          }),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        ),
      );
      if (expected > 0) yield* Deferred.await(done);

      const rows = (yield* Ref.get(ingestedRef))
        .filter((item) => item.source === "webhook")
        .flatMap((item) => item.batch.rows.map((row) => ({ resource: item.resource, row })));
      return {
        status: response.status,
        rows: JSON.parse(
          JSON.stringify(rows, (_key, value) => (typeof value === "bigint" ? `${value}n` : value)),
        ),
      };
    }).pipe(
      Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
    );
  }).pipe(Effect.scoped);

/** Only the fields a test is about. */
const summary = (result: Effect.Success<ReturnType<typeof post>>, keys: ReadonlyArray<string>) => ({
  status: result.status,
  rows: result.rows.map(
    ({ resource, row }: { resource: string; row: Record<string, unknown> }) => ({
      resource,
      ...Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, row[key]])),
      keys: Object.keys(row).length,
    }),
  ),
});

describe("webhook", () => {
  it.effect("rejects bad and missing signatures", () =>
    Effect.gen(function* () {
      const body = event("labeled", { issue });

      expect({
        otherSecret: yield* post("issues", body, {
          signature: signPayload(JSON.stringify(body), "other-secret"),
        }),
        missing: yield* post("issues", body, { signature: null }),
      }).toMatchInlineSnapshot(`
        {
          "missing": {
            "rows": [],
            "status": 401,
          },
          "otherSecret": {
            "rows": [],
            "status": 401,
          },
        }
      `);
    }),
  );

  it.effect("acknowledges pings, other installations, and other events without rows", () =>
    Effect.gen(function* () {
      expect({
        ping: yield* post("ping", { zen: "Keep it logically awesome.", hook_id: 1 }),
        otherInstallation: yield* post("issues", {
          ...event("labeled", { issue }),
          installation: { id: 1 },
        }),
        otherEvent: yield* post("star", event("created", {})),
      }).toMatchInlineSnapshot(`
        {
          "otherEvent": {
            "rows": [],
            "status": 200,
          },
          "otherInstallation": {
            "rows": [],
            "status": 200,
          },
          "ping": {
            "rows": [],
            "status": 200,
          },
        }
      `);
    }),
  );

  it.effect("maps payloads to rows and leaves out missing lists", () =>
    Effect.gen(function* () {
      const keys = ["id", "version", "labels", "assignees", "requested_reviewers", "body"];
      expect({
        issue: summary(yield* post("issues", event("labeled", { issue }), { expected: 1 }), keys),
        pullRequest: summary(
          yield* post(
            "pull_request",
            event("closed", { pull_request: without(pullRequest, "requested_reviewers") }),
            { expected: 1 },
          ),
          keys,
        ),
        comment: summary(
          yield* post("issue_comment", event("edited", { issue, comment: issueComment }), {
            expected: 1,
          }),
          ["id", "issue_number", "repository_id", "body"],
        ),
        repository: summary(
          yield* post("repository", event("renamed", { repository: otherRepository }), {
            expected: 1,
          }),
          ["id", "full_name", "topics"],
        ),
      }).toMatchInlineSnapshot(`
        {
          "comment": {
            "rows": [
              {
                "body": "First live check comment",
                "id": "6003550342n",
                "issue_number": "2n",
                "keys": 10,
                "repository_id": "1406396726n",
                "resource": "issue_comments",
              },
            ],
            "status": 200,
          },
          "issue": {
            "rows": [
              {
                "assignees": [
                  {
                    "id": "583231n",
                    "login": "octocat",
                    "type": "User",
                  },
                ],
                "body": "",
                "id": "5719289302n",
                "keys": 19,
                "labels": [
                  {
                    "id": "12557819502n",
                    "name": "bug",
                  },
                ],
                "resource": "issues",
                "version": "2026-10-05T22:04:14.000Z",
              },
            ],
            "status": 200,
          },
          "pullRequest": {
            "rows": [
              {
                "assignees": [],
                "body": "",
                "id": "4751110848n",
                "keys": 21,
                "labels": [],
                "resource": "pull_requests",
                "version": "2026-10-05T22:05:25.000Z",
              },
            ],
            "status": 200,
          },
          "repository": {
            "rows": [
              {
                "full_name": "octocat/spoon-knife",
                "id": "1406425446n",
                "keys": 18,
                "resource": "repositories",
                "topics": [],
              },
            ],
            "status": 200,
          },
        }
      `);
    }),
  );

  it.effect("writes delete rows for deleted and transferred objects", () =>
    Effect.gen(function* () {
      const deleteKeys = ["id", "version", "_deleted"];
      expect({
        issueDeleted: summary(
          yield* post("issues", event("deleted", { issue }), { expected: 1 }),
          deleteKeys,
        ),
        issueTransferred: summary(
          yield* post("issues", event("transferred", { issue, changes: {} }), { expected: 1 }),
          deleteKeys,
        ),
        commentDeleted: summary(
          yield* post("issue_comment", event("deleted", { issue, comment: issueComment }), {
            expected: 1,
          }),
          deleteKeys,
        ),
        repositoryDeleted: summary(
          yield* post("repository", event("deleted", { repository }), { expected: 1 }),
          deleteKeys,
        ),
      }).toMatchInlineSnapshot(`
        {
          "commentDeleted": {
            "rows": [
              {
                "_deleted": true,
                "id": "6003550342n",
                "keys": 3,
                "resource": "issue_comments",
                "version": "2026-10-06T12:00:00.000Z",
              },
            ],
            "status": 200,
          },
          "issueDeleted": {
            "rows": [
              {
                "_deleted": true,
                "id": "5719289302n",
                "keys": 3,
                "resource": "issues",
                "version": "2026-10-06T12:00:00.000Z",
              },
            ],
            "status": 200,
          },
          "issueTransferred": {
            "rows": [
              {
                "_deleted": true,
                "id": "5719289302n",
                "keys": 3,
                "resource": "issues",
                "version": "2026-10-06T12:00:00.000Z",
              },
            ],
            "status": 200,
          },
          "repositoryDeleted": {
            "rows": [
              {
                "_deleted": true,
                "id": "1406396726n",
                "keys": 3,
                "resource": "repositories",
                "version": "2026-10-06T12:00:00.000Z",
              },
            ],
            "status": 200,
          },
        }
      `);
    }),
  );
});
