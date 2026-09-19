import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { PostSchema, TemplateApiClient, TemplateConnector } from "../src/index";

describe("producer-template api (vcr)", () => {
  it.effect("replays posts list page with VCR", () =>
    Effect.gen(function* () {
      const api = yield* TemplateApiClient.TemplateApiClient;
      const result = yield* api.fetchList(PostSchema, "/posts", {
        page: 1,
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]?.version).toBe("1970-01-01T00:00:00.000Z");
      expect(result.hasMore).toBe(true);
    }).pipe(
      Effect.provide(
        TemplateApiClient.layerConfig(TemplateConnector.TemplateConfigDef.config).pipe(
          Layer.provide(
            VcrHttpClient.layer({ vcrName: "producer-template", mode: "replay" }).pipe(
              Layer.provide(FileSystemCassetteStore.layer()),
              Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
            ),
          ),
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                TEMPLATE_API_BASE_URL: "https://jsonplaceholder.typicode.com",
                TEMPLATE_API_TOKEN: "test",
              }),
            ),
          ),
        ),
      ),
      Effect.scoped,
    ),
  );
});
