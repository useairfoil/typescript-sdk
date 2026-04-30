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

    const cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(
      Layer.provide(NodeServices.layer),
    );
    const vcrRuntimeLayer = Layer.mergeAll(
      FetchHttpClient.layer,
      NodeServices.layer,
      cassetteStoreLayer,
    );
    const vcrWithDeps = VcrHttpClient.layer({ vcrName: "producer-template", mode: "replay" }).pipe(
      Layer.provide(vcrRuntimeLayer),
    );

    const testLayer = apiLayer.pipe(
      Layer.provide(vcrWithDeps),
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            TEMPLATE_API_BASE_URL: "https://jsonplaceholder.typicode.com",
            TEMPLATE_API_TOKEN: "test",
          }),
        ),
      ),
    );

    return program.pipe(Effect.provide(testLayer), Effect.scoped);
  });
});
