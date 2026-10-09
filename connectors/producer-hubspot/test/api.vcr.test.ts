import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConnectorApp } from "@useairfoil/connector-kit";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import { existsSync } from "node:fs";

import { HubSpotConnector, manifest } from "../src/index";

// Recording needs a test account. Skip until there is a cassette or a token.
const canRun =
  existsSync(new URL("./__cassettes__/api.vcr.test.cassette", import.meta.url)) ||
  process.env.HUBSPOT_ACCESS_TOKEN !== undefined;

const configLayer = ConfigProvider.layer(
  ConfigProvider.fromEnv().pipe(
    ConfigProvider.orElse(ConfigProvider.fromUnknown({ HUBSPOT_ACCESS_TOKEN: "pat-replay" })),
  ),
);

const connectorLayer = HubSpotConnector.layerConfig(HubSpotConnector.HubSpotConfigDef.config).pipe(
  Layer.provide(
    VcrHttpClient.layer({
      vcrName: "producer-hubspot",
      // The `Authorization` header is redacted by default. Owner details belong
      // to a real HubSpot user, who also attends the test meetings.
      redact: {
        responseHeaders: ["set-cookie"],
        responseBodyReplacements: {
          firstName: "Jo",
          lastName: "Owner",
          email: "owner@example.com",
          hs_all_attendee_emails: "ada@acme.example.com;owner@example.com",
        },
      },
    }).pipe(
      Layer.provide(FileSystemCassetteStore.layer()),
      Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
    ),
  ),
  Layer.provide(configLayer),
);

const cutoff = "2026-10-07T00:00:00.000Z";

// Every pass is already running, so each request is the same on replay.
const crmCursor = JSON.stringify({
  recent: { from: "2026-10-06T20:00:00.000Z", until: "2026-10-06T21:00:00.000Z" },
  delayed: { from: "2026-10-06T19:00:00.000Z", until: "2026-10-06T20:00:00.000Z" },
  archive: { last: "2026-10-06T00:00:00.000Z", startedAt: cutoff },
  refresh: { last: "2026-10-06T00:00:00.000Z", startedAt: cutoff },
});

describe.skipIf(!canRun)("HubSpot API (vcr)", () => {
  // Live clock: the rate limiter waits on it, so recording takes minutes.
  it.live(
    "checks, backfills, and reads changes for every resource",
    () =>
      Effect.gen(function* () {
        const check = yield* ConnectorApp.check(HubSpotConnector.HubSpotConnector, connectorLayer, {
          resources: manifest.resources.map((resource) => resource.name),
        });
        const connector = yield* HubSpotConnector.HubSpotConnector.pipe(
          Effect.provide(connectorLayer),
        );

        const results: Record<string, unknown> = {};
        for (const resource of connector.resources) {
          const backfill = yield* Effect.fromOption(Option.fromNullishOr(resource.backfill));
          const changes = yield* Effect.fromOption(Option.fromNullishOr(resource.changes));

          let rows = 0;
          let pageCursor: string | undefined;
          for (;;) {
            const page = yield* backfill.fetch({ cutoff, ...(pageCursor ? { pageCursor } : {}) });
            rows += page.rows.length;
            if (!page.hasMore) break;
            pageCursor = String(page.nextPageCursor);
          }
          const changed = yield* changes.fetch({ cursor: crmCursor });
          const deletes = changed.rows.filter((row) => row._deleted === true).length;

          results[resource.name] = {
            backfillRows: rows,
            changedRows: changed.rows.length - deletes,
            deletes,
          };
        }

        expect({ check, results }).toMatchInlineSnapshot(`
          {
            "check": {
              "calls": {
                "_tag": "ok",
              },
              "companies": {
                "_tag": "ok",
              },
              "contacts": {
                "_tag": "ok",
              },
              "deals": {
                "_tag": "ok",
              },
              "emails": {
                "_tag": "ok",
              },
              "line_items": {
                "_tag": "ok",
              },
              "meetings": {
                "_tag": "ok",
              },
              "notes": {
                "_tag": "ok",
              },
              "owners": {
                "_tag": "ok",
              },
              "pipelines": {
                "_tag": "error",
                "message": "HubSpot API returned 400 for /crm/pipelines/2026-09/tickets",
              },
              "products": {
                "_tag": "ok",
              },
              "tasks": {
                "_tag": "ok",
              },
              "tickets": {
                "_tag": "ok",
              },
            },
            "results": {
              "calls": {
                "backfillRows": 3,
                "changedRows": 3,
                "deletes": 0,
              },
              "companies": {
                "backfillRows": 3,
                "changedRows": 3,
                "deletes": 1,
              },
              "contacts": {
                "backfillRows": 5,
                "changedRows": 5,
                "deletes": 2,
              },
              "deals": {
                "backfillRows": 2,
                "changedRows": 2,
                "deletes": 0,
              },
              "emails": {
                "backfillRows": 3,
                "changedRows": 3,
                "deletes": 0,
              },
              "line_items": {
                "backfillRows": 1,
                "changedRows": 1,
                "deletes": 0,
              },
              "meetings": {
                "backfillRows": 2,
                "changedRows": 3,
                "deletes": 0,
              },
              "notes": {
                "backfillRows": 1,
                "changedRows": 1,
                "deletes": 1,
              },
              "owners": {
                "backfillRows": 1,
                "changedRows": 1,
                "deletes": 0,
              },
              "pipelines": {
                "backfillRows": 2,
                "changedRows": 2,
                "deletes": 0,
              },
              "products": {
                "backfillRows": 1,
                "changedRows": 1,
                "deletes": 0,
              },
              "tasks": {
                "backfillRows": 3,
                "changedRows": 3,
                "deletes": 0,
              },
              "tickets": {
                "backfillRows": 1,
                "changedRows": 1,
                "deletes": 0,
              },
            },
          }
        `);
      }),
    5 * 60_000,
  );
});
