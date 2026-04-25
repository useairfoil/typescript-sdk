import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { makeTemplateApiClient, TemplateApiClient } from "../src/api";
import { PostSchema, TemplateConfigConfig } from "../src/index";

// Replays a single page of JSONPlaceholder /posts from a recorded cassette.
// This mirrors the producer-polar VCR setup: the connector-level flow is
// covered by webhook.test.ts, and this test exercises only the API surface.
describe("producer-template api (vcr)", () => {
  it.effect("replays posts list page with VCR", () => {
    const program = Effect.gen(function* () {
      const api = yield* TemplateApiClient;
      const result = yield* api.fetchList(PostSchema, "/posts", {
        page: 1,
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.hasMore).toBe(true);
    }).pipe(Effect.scoped);

    const apiLayer = Layer.effect(TemplateApiClient)(
      Effect.gen(function* () {
        const config = yield* TemplateConfigConfig;
        return yield* makeTemplateApiClient(config);
      }),
    );

    return program.pipe(
      Effect.provide(apiLayer),
      Effect.provide(
        VcrHttpClient.layer({
          vcrName: "producer-template",
          mode: "replay",
        }),
      ),
      Effect.provide(FileSystemCassetteStore.layer()),
      Effect.provide(FetchHttpClient.layer),
      Effect.provide(NodeServices.layer),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({
          TEMPLATE_API_BASE_URL: "https://jsonplaceholder.typicode.com",
          TEMPLATE_API_TOKEN: "test",
        }),
      ),
      Effect.scoped,
    );
  });
});
