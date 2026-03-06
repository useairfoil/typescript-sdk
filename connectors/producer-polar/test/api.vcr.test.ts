import { NodeFileSystem, NodeHttpClient } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  CassetteStoreLive,
  VcrHttpClientLayer,
} from "@useairfoil/effect-http-client";
import { Config, ConfigProvider, Effect, Layer, Option, Schema } from "effect";
import { makePolarApiClient, PolarApiClient } from "../src/api";

// Tests the PolarApiClient directly using a recorded cassette so no webhook
// is needed to trigger a backfill cutoff. The connector-level backfill flow
// is covered by webhook.test.ts.
describe("producer-polar api (vcr)", () => {
  it.effect("replays customers list page with VCR", () => {
    const config = Config.all({
      accessToken: Config.option(Config.string("POLAR_ACCESS_TOKEN")),
      apiBaseUrl: Config.string("POLAR_API_BASE_URL").pipe(
        Config.withDefault("https://sandbox-api.polar.sh/v1/"),
      ),
    });

    const cassetteLayer = CassetteStoreLive.pipe(
      Layer.provide(NodeFileSystem.layer),
    );
    const vcrLayer = VcrHttpClientLayer().pipe(
      Layer.provide(Layer.mergeAll(NodeHttpClient.layerFetch, cassetteLayer)),
    );

    const apiLayer = Layer.effect(PolarApiClient)(
      Effect.gen(function* () {
        const { accessToken, apiBaseUrl } = yield* config;
        const token = Option.getOrElse(accessToken, () => "test");
        return yield* makePolarApiClient({
          accessToken: token,
          apiBaseUrl,
        });
      }),
    );

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

    return program.pipe(
      Effect.provide(apiLayer),
      Effect.provide(vcrLayer),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv(),
      ),
      Effect.scoped,
    );
  });
});
