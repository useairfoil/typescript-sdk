import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConnectorError, Ingestion } from "@useairfoil/connector-kit";
import { Config, ConfigProvider, DateTime, Deferred, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { TemplateApiClientService } from "../src/api";

import { TemplateApiClient, TemplateConnector } from "../src/index";
import { makeTestPublisher } from "./helpers";

const postWebhookPayload = {
  type: "post.created",
  timestamp: "2026-01-01T00:00:00Z",
  data: {
    id: 1,
    userId: 1,
    title: "sunt aut facere",
    body: "quia et suscipit",
  },
} as const;

// API stub — the webhook test does not exercise any backfill, so fetchList
// returns an empty page and fetchJson is never expected to be called.
const makeApiStub = (): TemplateApiClientService => ({
  fetchJson: (_schema) => Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
  fetchList: (_schema) => Effect.succeed({ items: [], hasMore: false }),
});

describe("producer-template webhook", () => {
  it.effect("publishes live webhook batches", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* TemplateConnector.TemplateConnector;
      const now = yield* DateTime.now;

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.runConnector(connector, {
            initialCutoff: now,
            webhook: {
              routes,
            },
          }),
        );

        const client = yield* HttpClient.HttpClient;
        const request = HttpClientRequest.post("/webhooks/template").pipe(
          HttpClientRequest.bodyJsonUnsafe(postWebhookPayload),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(200);

        yield* Deferred.await(done);
        const published = yield* Ref.get(publishedRef);
        expect(published.length).toBe(1);
        expect(published[0]?.name).toBe("posts");
      }).pipe(
        Effect.provide(Layer.mergeAll(Ingestion.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(
      Effect.provide(
        Layer.effect(TemplateConnector.TemplateConnector)(
          Config.unwrap(TemplateConnector.TemplateConfigConfig)
            .asEffect()
            .pipe(Effect.flatMap(TemplateConnector.make)),
        ).pipe(
          Layer.provide(Layer.succeed(TemplateApiClient.TemplateApiClient)(makeApiStub())),
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
