import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

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

    const cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(
      Layer.provide(NodeServices.layer),
    );
    const vcrRuntimeLayer = Layer.mergeAll(
      FetchHttpClient.layer,
      NodeServices.layer,
      cassetteStoreLayer,
    );
    const vcrWithDeps = VcrHttpClient.layer({ vcrName: "producer-polar" }).pipe(
      Layer.provide(vcrRuntimeLayer),
    );

    const testLayer = apiLayer.pipe(
      Layer.provide(vcrWithDeps),
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            POLAR_ACCESS_TOKEN: "test",
            POLAR_API_BASE_URL: "https://sandbox-api.polar.sh/v1/",
          }),
        ),
      ),
    );

    return program.pipe(Effect.provide(testLayer), Effect.scoped);
  });
});
