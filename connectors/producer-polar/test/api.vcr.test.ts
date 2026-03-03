import { access } from "node:fs/promises";
import * as Path from "node:path";
import { FetchHttpClient } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  CassetteStoreLive,
  VcrHttpClientLayer,
} from "@useairfoil/effect-http-client";
import { Effect, Layer, Schema } from "effect";
import { PolarApiClient, PolarApiClientConfig } from "../src/api";
import type { PolarConfig } from "../src/index";

// Tests the PolarApiClient directly using a recorded cassette so no webhook
// is needed to trigger a backfill cutoff. The connector-level backfill flow
// is covered by webhook.test.ts.
describe("producer-polar api (vcr)", () => {
  it.effect("replays customers list page with VCR", () => {
    const cassetteDir = Path.join(process.cwd(), "cassettes");
    const cassetteName = "customers-backfill-replay";
    const cassettePath = Path.join(cassetteDir, `${cassetteName}.json`);

    const accessToken = process.env.POLAR_ACCESS_TOKEN;

    const config: PolarConfig = {
      accessToken: accessToken ?? "test",
      apiBaseUrl: "https://sandbox-api.polar.sh/v1/",
    };

    const cassetteLayer = CassetteStoreLive.pipe(
      Layer.provide(NodeFileSystem.layer),
    );
    const vcrLayer = VcrHttpClientLayer({
      cassetteDir,
      cassetteName,
      mode: "auto",
      matchIgnore: { requestHeaders: ["authorization"] },
      redact: { requestHeaders: ["authorization"] },
    }).pipe(
      Layer.provide(Layer.mergeAll(FetchHttpClient.layer, cassetteLayer)),
    );

    const apiLayer = PolarApiClientConfig(config).pipe(Layer.provide(vcrLayer));

    return Effect.gen(function* () {
      if (!accessToken) {
        const exists = yield* Effect.tryPromise({
          try: () =>
            access(cassettePath)
              .then(() => true)
              .catch(() => false),
          catch: () => false,
        });
        if (!exists) {
          return yield* Effect.fail(
            new Error(
              "missing POLAR_ACCESS_TOKEN for vcr record; run with `POLAR_ACCESS_TOKEN=...` or `bun --env-file=.env`",
            ),
          );
        }
      }

      const api = yield* PolarApiClient;
      const result = yield* api.fetchList(Schema.Unknown, "customers/", {
        page: 1,
        limit: 100,
        sorting: "-created_at",
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.pagination.total_count).toBeGreaterThan(0);
    }).pipe(Effect.provide(apiLayer), Effect.scoped);
  });
});
