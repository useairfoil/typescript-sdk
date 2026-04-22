import { NodeFileSystem, NodeHttpClient } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { CassetteStoreLive, VcrHttpClientLayer } from "@useairfoil/effect-http-client";
import { ConfigProvider, Effect, Layer, Schema } from "effect";

import { makePolarApiClient, PolarApiClient } from "../src/api";
import { PolarConfigConfig } from "../src/index";

// Tests the PolarApiClient directly using a recorded cassette so no webhook
// is needed to trigger a backfill cutoff. The connector-level backfill flow
// is covered by webhook.test.ts.
describe("producer-polar api (vcr)", () => {
  it.effect("replays customers list page with VCR", () => {
    const program = Effect.gen(function* () {
      const api = yield* PolarApiClient;
      const result = yield* api.fetchList(Schema.Any, "customers/", {
        page: 1,
        limit: 100,
        sorting: "-created_at",
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.pagination.total_count).toBeGreaterThan(0);
    }).pipe(Effect.scoped);

    const apiLayer = Layer.effect(PolarApiClient)(
      Effect.gen(function* () {
        const config = yield* PolarConfigConfig;
        return yield* makePolarApiClient(config);
      }),
    );

    const cassetteLayer = CassetteStoreLive.pipe(Layer.provide(NodeFileSystem.layer));
    const vcrLayer = VcrHttpClientLayer({
      connectorName: "producer-polar",
      mode: "replay",
    }).pipe(Layer.provide(Layer.mergeAll(NodeHttpClient.layerFetch, cassetteLayer)));

    return program.pipe(
      Effect.provide(apiLayer),
      Effect.provide(vcrLayer),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({
          POLAR_ACCESS_TOKEN: "test",
          POLAR_API_BASE_URL: "https://sandbox-api.polar.sh/v1/",
        }),
      ),
      Effect.scoped,
    );
  });
});
