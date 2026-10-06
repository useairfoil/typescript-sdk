import { describe, expect, it } from "@effect/vitest";
import { ConnectorApp } from "@useairfoil/connector-kit";
import { Effect, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { GitHubConnector, manifest } from "../src/index";
import { tableSchemas } from "../src/tables";
import {
  issue,
  issueComment,
  otherRepository,
  pullRequest,
  pullRequestIssue,
  repository,
} from "./fixtures/objects";
import { type FakeGitHub, connectorLayer, makeFakeClient, without } from "./helpers";

const now = Date.parse("2026-10-06T12:00:00.000Z");
const cutoff = "2026-10-06T00:00:00.000Z";

type ResourceName = (typeof manifest.resources)[number]["name"];

const repositoriesUrl = "/installation/repositories?per_page=100";

/** Answers the installation's repository list, then `pages`. */
const withRepositories =
  (repositories: ReadonlyArray<unknown>, pages: Readonly<Record<string, unknown>>): FakeGitHub =>
  (url) =>
    url === repositoriesUrl
      ? { body: { total_count: repositories.length, repositories } }
      : pages[url] === undefined
        ? undefined
        : { body: pages[url] };

const getResource = (name: ResourceName, fake: FakeGitHub) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const { client, requests } = yield* makeFakeClient(fake);
    const connector = yield* GitHubConnector.GitHubConnector.pipe(
      Effect.provide(connectorLayer(client)),
    );
    const resource = yield* Effect.fromOption(
      Option.fromNullishOr(connector.resources.find((item) => item.name === name)),
    );
    const backfill = yield* Effect.fromOption(Option.fromNullishOr(resource.backfill));
    const changes = yield* Effect.fromOption(Option.fromNullishOr(resource.changes));
    return { backfill, changes, requests: Ref.get(requests) };
  });

// Bigints and dates print plainly in snapshots.
const plain = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? `${item}n` : item)));

describe("resources", () => {
  it.effect("matches the table schemas", () =>
    Effect.gen(function* () {
      const { client } = yield* makeFakeClient(() => undefined);
      const connector = yield* GitHubConnector.GitHubConnector.pipe(
        Effect.provide(connectorLayer(client)),
      );

      expect(connector.resources.map((item) => item.name)).toEqual(
        manifest.resources.map((item) => item.name),
      );
      for (const resource of connector.resources) {
        expect(tableSchemas[resource.name]).toBe(resource.rowSchema);
      }
    }),
  );

  it.effect("checks every resource with read-only calls", () =>
    Effect.gen(function* () {
      const { client, requests } = yield* makeFakeClient((url) =>
        url.startsWith("/installation/repositories")
          ? { body: { total_count: 1, repositories: [repository] } }
          : { body: [] },
      );

      const result = yield* ConnectorApp.check(
        GitHubConnector.GitHubConnector,
        connectorLayer(client),
        { resources: manifest.resources.map((resource) => resource.name) },
      );

      expect({
        result,
        requests: yield* Ref.get(requests),
      }).toMatchInlineSnapshot(`
        {
          "requests": [
            "/installation/repositories?per_page=1",
            "/installation/repositories?per_page=100",
            "/repos/octocat/hello-world/issues?state=all&per_page=1",
            "/installation/repositories?per_page=100",
            "/repos/octocat/hello-world/pulls?state=all&per_page=1",
            "/installation/repositories?per_page=100",
            "/repos/octocat/hello-world/issues/comments?per_page=1",
          ],
          "result": {
            "issue_comments": {
              "_tag": "ok",
            },
            "issues": {
              "_tag": "ok",
            },
            "pull_requests": {
              "_tag": "ok",
            },
            "repositories": {
              "_tag": "ok",
            },
          },
        }
      `);
    }),
  );

  it.effect("backfills issues repository by repository, up to the cutoff", () =>
    Effect.gen(function* () {
      const first =
        "/repos/octocat/hello-world/issues?state=all&sort=created&direction=asc&per_page=100";
      const second = "https://api.github.com/repositories/1406396726/issues?after=Y3Vyc29y";
      const other =
        "/repos/octocat/spoon-knife/issues?state=all&sort=created&direction=asc&per_page=100";
      const pages: FakeGitHub = (url) =>
        url === repositoriesUrl
          ? {
              body: {
                total_count: 2,
                repositories: [otherRepository, repository],
              },
            }
          : url === first
            ? { body: [issue, pullRequestIssue], next: second }
            : url === second
              ? // The second issue is after the cutoff, so the repository is done.
                {
                  body: [
                    { ...without(issue, "assignees"), id: 2, number: 2, body: "Kept" },
                    {
                      ...issue,
                      id: 3,
                      number: 4,
                      created_at: "2026-10-06T08:00:00Z",
                    },
                  ],
                  next: "https://api.github.com/repositories/1406396726/issues?after=later",
                }
              : url === other
                ? { body: [] }
                : undefined;
      const { backfill, requests } = yield* getResource("issues", pages);

      const pagesRead: Array<unknown> = [];
      let pageCursor: string | undefined;
      for (;;) {
        const page = yield* backfill.fetch({
          cutoff,
          ...(pageCursor ? { pageCursor } : {}),
        });
        pagesRead.push({
          cursor: page.nextPageCursor ?? null,
          rows: plain(page.rows),
        });
        if (!page.hasMore) break;
        pageCursor = String(page.nextPageCursor);
      }

      expect({ pagesRead, requests: yield* requests }).toMatchInlineSnapshot(`
        {
          "pagesRead": [
            {
              "cursor": "{"repositoryId":1406396726,"next":"https://api.github.com/repositories/1406396726/issues?after=Y3Vyc29y"}",
              "rows": [
                {
                  "assignees": [
                    {
                      "id": "583231n",
                      "login": "octocat",
                      "type": "User",
                    },
                  ],
                  "author_association": "OWNER",
                  "body": "",
                  "closed_at": null,
                  "comments": "0n",
                  "created_at": "2026-10-05T21:40:30.000Z",
                  "html_url": "https://github.com/octocat/hello-world/issues/1",
                  "id": "5719289302n",
                  "labels": [
                    {
                      "id": "12557819502n",
                      "name": "bug",
                    },
                  ],
                  "locked": false,
                  "milestone": null,
                  "node_id": "I_kwDOU9PpNs8AAAABVOVt1g",
                  "number": "1n",
                  "repository_id": "1406396726n",
                  "state": "open",
                  "state_reason": null,
                  "title": "Live check A",
                  "user": {
                    "id": "583231n",
                    "login": "octocat",
                    "type": "User",
                  },
                  "version": "2026-10-05T22:04:14.000Z",
                },
              ],
            },
            {
              "cursor": "{"repositoryId":1406425446}",
              "rows": [
                {
                  "assignees": [],
                  "author_association": "OWNER",
                  "body": "Kept",
                  "closed_at": null,
                  "comments": "0n",
                  "created_at": "2026-10-05T21:40:30.000Z",
                  "html_url": "https://github.com/octocat/hello-world/issues/1",
                  "id": "2n",
                  "labels": [
                    {
                      "id": "12557819502n",
                      "name": "bug",
                    },
                  ],
                  "locked": false,
                  "milestone": null,
                  "node_id": "I_kwDOU9PpNs8AAAABVOVt1g",
                  "number": "2n",
                  "repository_id": "1406396726n",
                  "state": "open",
                  "state_reason": null,
                  "title": "Live check A",
                  "user": {
                    "id": "583231n",
                    "login": "octocat",
                    "type": "User",
                  },
                  "version": "2026-10-05T22:04:14.000Z",
                },
              ],
            },
            {
              "cursor": null,
              "rows": [],
            },
          ],
          "requests": [
            "/installation/repositories?per_page=100",
            "/repos/octocat/hello-world/issues?state=all&sort=created&direction=asc&per_page=100",
            "https://api.github.com/repositories/1406396726/issues?after=Y3Vyc29y",
            "/repos/octocat/spoon-knife/issues?state=all&sort=created&direction=asc&per_page=100",
          ],
        }
      `);
    }),
  );

  it.effect(
    "reads issue changes newest first, new repositories in full, and skips old archives",
    () =>
      Effect.gen(function* () {
        const archived = {
          ...otherRepository,
          id: 99,
          full_name: "octocat/old",
          archived: true,
        };
        // Archiving updates the repository, so its last changes are still read.
        const justArchived = {
          ...archived,
          id: 98,
          full_name: "octocat/just-archived",
          updated_at: "2026-10-06T11:20:00Z",
        };
        const newRepository = { ...otherRepository, id: 1406425446 };
        const { changes, requests } = yield* getResource(
          "issues",
          withRepositories([repository, archived, justArchived, newRepository], {
            "/repos/octocat/hello-world/issues?state=all&sort=updated&direction=desc&per_page=100&since=2026-10-06T10:55:00.000Z":
              [
                { ...issue, updated_at: "2026-10-06T11:10:00Z" },
                { ...pullRequestIssue, updated_at: "2026-10-06T11:10:00Z" },
              ],
            "/repos/octocat/just-archived/issues?state=all&sort=updated&direction=desc&per_page=100&since=2026-10-06T10:55:00.000Z":
              [{ ...issue, id: 8, number: 8, updated_at: "2026-10-06T11:15:00Z" }],
            "/repos/octocat/spoon-knife/issues?state=all&sort=updated&direction=desc&per_page=100":
              [{ ...issue, id: 7, number: 7 }],
          }),
        );

        const result = yield* changes.fetch({
          cursor: JSON.stringify({
            since: "2026-10-06T11:00:00.000Z",
            repositoryIds: [repository.id, 99, 98],
          }),
        });

        expect({
          cursor: result.cursor,
          rows: result.rows.map((row) => `${row.id}`),
          requests: yield* requests,
        }).toMatchInlineSnapshot(`
          {
            "cursor": "{"since":"2026-10-06T12:00:00.000Z","repositoryIds":[98,99,1406396726,1406425446]}",
            "requests": [
              "/installation/repositories?per_page=100",
              "/repos/octocat/just-archived/issues?state=all&sort=updated&direction=desc&per_page=100&since=2026-10-06T10:55:00.000Z",
              "/repos/octocat/hello-world/issues?state=all&sort=updated&direction=desc&per_page=100&since=2026-10-06T10:55:00.000Z",
              "/repos/octocat/spoon-knife/issues?state=all&sort=updated&direction=desc&per_page=100",
            ],
            "rows": [
              "8",
              "5719289302",
              "7",
            ],
          }
        `);
      }),
  );

  it.effect("splits a long read across runs and keeps the run's start", () =>
    Effect.gen(function* () {
      // A new repository with 15 pages, then a known one with 10.
      const big = { ...otherRepository, id: 1, full_name: "octocat/big" };
      const pageUrl = (name: string, page: number) =>
        `https://api.github.com/repositories/${name}/issues?page=${page}`;
      const firstUrl = (name: string, since = "") =>
        `/repos/octocat/${name}/issues?state=all&sort=updated&direction=desc&per_page=100${since}`;
      const pages =
        (name: string, count: number, first: string): FakeGitHub =>
        (url) => {
          const page =
            url === first ? 1 : Number(url.match(new RegExp(`${name}/issues\\?page=(\\d+)`))?.[1]);
          if (!page) return undefined;
          return {
            body: [{ ...issue, id: page, number: page, updated_at: "2026-10-06T11:30:00Z" }],
            ...(page < count ? { next: pageUrl(name, page + 1) } : {}),
          };
        };
      const bigPages = pages("big", 15, firstUrl("big"));
      const knownPages = pages(
        "hello-world",
        10,
        firstUrl("hello-world", "&since=2026-10-06T10:55:00.000Z"),
      );
      const { changes, requests } = yield* getResource("issues", (url) =>
        url === repositoriesUrl
          ? { body: { total_count: 2, repositories: [repository, big] } }
          : (bigPages(url) ?? knownPages(url)),
      );

      const first = yield* changes.fetch({
        cursor: JSON.stringify({
          since: "2026-10-06T11:00:00.000Z",
          repositoryIds: [repository.id],
        }),
      });
      yield* TestClock.adjust("1 minute");
      const second = yield* changes.fetch({ cursor: String(first.cursor) });

      expect({
        first: { cursor: first.cursor, hasMore: first.hasMore, rows: first.rows.length },
        second: { cursor: second.cursor, hasMore: second.hasMore, rows: second.rows.length },
        requests: (yield* requests).length,
      }).toMatchInlineSnapshot(`
        {
          "first": {
            "cursor": "{"since":"2026-10-06T11:00:00.000Z","repositoryIds":[1406396726],"pending":{"until":"2026-10-06T12:00:00.000Z","repositoryIds":[1,1406396726],"repositoryId":1406396726,"url":"https://api.github.com/repositories/hello-world/issues?page=6"}}",
            "hasMore": true,
            "rows": 20,
          },
          "requests": 27,
          "second": {
            "cursor": "{"since":"2026-10-06T12:00:00.000Z","repositoryIds":[1,1406396726]}",
            "hasMore": false,
            "rows": 5,
          },
        }
      `);
    }),
  );

  it.effect("treats every repository as read on the first changes run", () =>
    Effect.gen(function* () {
      const { changes, requests } = yield* getResource(
        "issue_comments",
        withRepositories([repository], {
          "/repos/octocat/hello-world/issues/comments?sort=updated&direction=desc&per_page=100&since=2026-10-05T23:55:00.000Z":
            [{ ...issueComment, updated_at: "2026-10-06T00:30:00Z" }],
        }),
      );

      const result = yield* changes.fetch({ cursor: cutoff });

      expect({
        cursor: result.cursor,
        rows: plain(result.rows),
        requests: yield* requests,
      }).toMatchInlineSnapshot(`
        {
          "cursor": "{"since":"2026-10-06T12:00:00.000Z","repositoryIds":[1406396726]}",
          "requests": [
            "/installation/repositories?per_page=100",
            "/repos/octocat/hello-world/issues/comments?sort=updated&direction=desc&per_page=100&since=2026-10-05T23:55:00.000Z",
          ],
          "rows": [
            {
              "author_association": "OWNER",
              "body": "First live check comment",
              "created_at": "2026-10-05T21:40:52.000Z",
              "html_url": "https://github.com/octocat/hello-world/issues/2#issuecomment-6003550342",
              "id": "6003550342n",
              "issue_number": "2n",
              "node_id": "IC_kwDOU9PpNs8AAAABZdbohg",
              "repository_id": "1406396726n",
              "user": {
                "id": "583231n",
                "login": "octocat",
                "type": "User",
              },
              "version": "2026-10-06T00:30:00.000Z",
            },
          ],
        }
      `);
    }),
  );

  it.effect("stops reading pull requests at the first one older than the cursor", () =>
    Effect.gen(function* () {
      const older = {
        ...pullRequest,
        id: 2,
        number: 2,
        updated_at: "2026-10-01T00:00:00Z",
      };
      const { changes, requests } = yield* getResource("pull_requests", (url) =>
        url === repositoriesUrl
          ? {
              body: {
                total_count: 2,
                // GitHub returns 404 for its pull requests, so it is skipped.
                repositories: [repository, { ...otherRepository, has_pull_requests: false }],
              },
            }
          : url ===
              "/repos/octocat/hello-world/pulls?state=all&sort=updated&direction=desc&per_page=100"
            ? {
                body: [
                  {
                    ...without(pullRequest, "requested_reviewers"),
                    updated_at: "2026-10-06T11:30:00Z",
                  },
                  older,
                ],
                next: "https://api.github.com/repositories/1406396726/pulls?page=2",
              }
            : undefined,
      );

      const result = yield* changes.fetch({
        cursor: JSON.stringify({
          since: "2026-10-06T11:00:00.000Z",
          repositoryIds: [repository.id],
        }),
      });

      expect({
        cursor: result.cursor,
        rows: plain(result.rows),
        requests: yield* requests,
      }).toMatchInlineSnapshot(`
        {
          "cursor": "{"since":"2026-10-06T12:00:00.000Z","repositoryIds":[1406396726]}",
          "requests": [
            "/installation/repositories?per_page=100",
            "/repos/octocat/hello-world/pulls?state=all&sort=updated&direction=desc&per_page=100",
          ],
          "rows": [
            {
              "assignees": [],
              "author_association": "OWNER",
              "base": {
                "label": "octocat:main",
                "ref": "main",
                "sha": "351503f0426ffd1478bf966741fd57856a1422e0",
              },
              "body": "",
              "closed_at": "2026-10-05T22:05:25.000Z",
              "created_at": "2026-10-05T21:43:17.000Z",
              "draft": false,
              "head": {
                "label": "octocat:octocat-patch-1",
                "ref": "octocat-patch-1",
                "sha": "9eb3a7d2ad61c47a7ee47c07e9787a616d0a228f",
              },
              "html_url": "https://github.com/octocat/hello-world/pull/3",
              "id": "4751110848n",
              "labels": [],
              "locked": false,
              "merged_at": null,
              "milestone": null,
              "node_id": "PR_kwDOU9PpNs8AAAABGzAywA",
              "number": "3n",
              "repository_id": "1406396726n",
              "requested_reviewers": [],
              "state": "closed",
              "title": "Update README.md",
              "user": {
                "id": "583231n",
                "login": "octocat",
                "type": "User",
              },
              "version": "2026-10-06T11:30:00.000Z",
            },
          ],
        }
      `);
    }),
  );

  it.effect("backfills repositories created before the cutoff and finds new ones in changes", () =>
    Effect.gen(function* () {
      const later = {
        ...otherRepository,
        id: 5,
        created_at: "2026-10-06T06:00:00Z",
      };
      const { backfill, changes } = yield* getResource(
        "repositories",
        withRepositories([repository, later], {}),
      );

      const page = yield* backfill.fetch({ cutoff });
      const changed = yield* changes.fetch({
        cursor: JSON.stringify({
          since: "2026-10-06T11:00:00.000Z",
          repositoryIds: [repository.id],
        }),
      });

      expect({
        backfill: plain(page),
        changes: changed.rows.map((row) => `${row.id}`),
      }).toMatchInlineSnapshot(`
        {
          "backfill": {
            "hasMore": false,
            "rows": [
              {
                "_deleted": false,
                "archived": false,
                "created_at": "2026-10-05T21:26:32.000Z",
                "default_branch": "main",
                "description": "",
                "disabled": false,
                "fork": false,
                "full_name": "octocat/hello-world",
                "html_url": "https://github.com/octocat/hello-world",
                "id": "1406396726n",
                "language": null,
                "name": "hello-world",
                "node_id": "R_kgDOU9PpNg",
                "owner": {
                  "id": "583231n",
                  "login": "octocat",
                  "type": "User",
                },
                "private": true,
                "topics": [],
                "version": "2026-10-05T21:26:33.000Z",
                "visibility": "private",
              },
            ],
          },
          "changes": [
            "5",
          ],
        }
      `);
    }),
  );
});
