import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  ConnectorError,
  runConnector,
  StateStoreInMemory,
} from "@useairfoil/connector-kit";
import { ConfigProvider, Deferred, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { TemplateApiClient, type TemplateApiClientService } from "../src/api";
import { TemplateConnector, TemplateConnectorConfig } from "../src/index";
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
  fetchJson: (_schema) =>
    Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
  fetchList: (_schema) => Effect.succeed({ items: [], hasMore: false }),
});

describe("producer-template webhook", () => {
  it.effect("publishes live webhook batches", () => {
    const runtimeLayer = NodeHttpServer.layerTest;
    const apiLayer = Layer.succeed(TemplateApiClient)(makeApiStub());

    const connectorLayer = TemplateConnectorConfig().pipe(
      Layer.provide(apiLayer),
    );
    const configProvider = ConfigProvider.fromUnknown({
      TEMPLATE_API_BASE_URL: "https://jsonplaceholder.typicode.com",
      TEMPLATE_API_TOKEN: "test",
    });

    return Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* TemplateConnector;
      const runLayer = Layer.mergeAll(StateStoreInMemory, layer, runtimeLayer);

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          runConnector(connector, {
            initialCutoff: new Date(),
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
      }).pipe(Effect.provide(runLayer));
    }).pipe(
      Effect.provide(connectorLayer),
      Effect.provide(runtimeLayer),
      Effect.provideService(ConfigProvider.ConfigProvider, configProvider),
      Effect.scoped,
    ) as Effect.Effect<void, ConnectorError, never>;
  });
});
