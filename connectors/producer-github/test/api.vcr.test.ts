import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConnectorApp } from "@useairfoil/connector-kit";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import { generateKeyPairSync } from "node:crypto";
import { existsSync } from "node:fs";

import { GitHubConnector, manifest } from "../src/index";

// Recording needs a test installation. Skip until there is a cassette or a key.
const canRun =
  existsSync(new URL("./__cassettes__/api.vcr.test.cassette", import.meta.url)) ||
  process.env.GITHUB_APP_PRIVATE_KEY !== undefined;

// Replays still sign a JWT, but GitHub never sees it.
const replayKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs1", format: "pem" })
  .toString();

const configLayer = ConfigProvider.layer(
  ConfigProvider.fromEnv().pipe(
    ConfigProvider.orElse(
      ConfigProvider.fromUnknown({
        GITHUB_APP_CLIENT_ID: "Iv23liReplay",
        GITHUB_APP_PRIVATE_KEY: replayKey,
        // The installation the cassette was recorded with.
        GITHUB_INSTALLATION_ID: "168295910",
        GITHUB_WEBHOOK_SECRET: "replay",
      }),
    ),
  ),
);

const connectorLayer = GitHubConnector.layerConfig(GitHubConnector.GitHubConfigDef.config).pipe(
  Layer.provide(
    VcrHttpClient.layer({
      vcrName: "producer-github",
      // The `Authorization` header is redacted by default. Account names stay in
      // URLs, because requests are built from them.
      redact: {
        responseBodyReplacements: {
          token: "ghs_replay",
          login: "octocat",
          avatar_url: "https://avatars.githubusercontent.com/u/583231",
        },
      },
    }).pipe(
      Layer.provide(FileSystemCassetteStore.layer()),
      Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
    ),
  ),
  Layer.provide(configLayer),
);

describe.skipIf(!canRun)("GitHub API (vcr)", () => {
  // Live clock: GitHub rejects a JWT signed at the test clock's time.
  it.live("checks, backfills, and reads changes for every resource", () =>
    Effect.gen(function* () {
      const check = yield* ConnectorApp.check(GitHubConnector.GitHubConnector, connectorLayer, {
        resources: manifest.resources.map((resource) => resource.name),
      });
      const connector = yield* GitHubConnector.GitHubConnector;

      const results: Record<string, unknown> = {};
      for (const resource of connector.resources) {
        const backfill = yield* Effect.fromOption(Option.fromNullishOr(resource.backfill));
        const changes = yield* Effect.fromOption(Option.fromNullishOr(resource.changes));
        const cutoff = "2026-10-06T00:00:00.000Z";

        let rows = 0;
        let pages = 0;
        let pageCursor: string | undefined;
        for (;;) {
          const page = yield* backfill.fetch({ cutoff, ...(pageCursor ? { pageCursor } : {}) });
          rows += page.rows.length;
          pages += 1;
          if (!page.hasMore) break;
          pageCursor = String(page.nextPageCursor);
        }
        // Every repository is new, so changes read them from the start.
        const changed = yield* changes.fetch({
          cursor: JSON.stringify({ since: cutoff, repositoryIds: [] }),
        });

        results[resource.name] = {
          backfillPages: pages,
          backfillRows: rows,
          changedRows: changed.rows.length,
        };
      }

      expect({ check, results }).toMatchInlineSnapshot(`
        {
          "check": {
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
          "results": {
            "issue_comments": {
              "backfillPages": 2,
              "backfillRows": 3,
              "changedRows": 3,
            },
            "issues": {
              "backfillPages": 1,
              "backfillRows": 1,
              "changedRows": 1,
            },
            "pull_requests": {
              "backfillPages": 2,
              "backfillRows": 5,
              "changedRows": 5,
            },
            "repositories": {
              "backfillPages": 1,
              "backfillRows": 2,
              "changedRows": 2,
            },
          },
        }
      `);
    }).pipe(Effect.provide(connectorLayer)),
  );
});
