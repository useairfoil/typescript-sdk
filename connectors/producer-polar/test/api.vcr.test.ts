import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { PolarApiClient, PolarConnector } from "../src/index";

// Tests the PolarApiClient directly using a recorded cassette so no webhook
// is needed to trigger a backfill cutoff. The connector-level backfill flow
// is covered by webhook.test.ts.
describe("producer-polar api (vcr)", () => {
  it.effect("replays customers list page with VCR", () =>
    Effect.gen(function* () {
      const api = yield* PolarApiClient.PolarApiClient;
      const result = yield* api.fetchList(Schema.Any, "customers/", {
        page: 1,
        limit: 100,
        sorting: "-created_at",
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.pagination.total_count).toBeGreaterThan(0);
    }).pipe(
      Effect.provide(
        PolarApiClient.layerConfig(PolarConnector.PolarConfigConfig).pipe(
          Layer.provide(
            VcrHttpClient.layer({ vcrName: "producer-polar" }).pipe(
              Layer.provide(FileSystemCassetteStore.layer()),
              Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
            ),
          ),
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                POLAR_ACCESS_TOKEN: "test",
                POLAR_API_BASE_URL: "https://sandbox-api.polar.sh/v1/",
              }),
            ),
          ),
        ),
      ),
      Effect.scoped,
    ),
  );
});
