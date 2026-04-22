import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  ConnectorError,
  runConnector,
  StateStoreInMemory,
} from "@useairfoil/connector-kit";
import { ConfigProvider, Deferred, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { PolarApiClient, type PolarApiClientService } from "../src/api";
import { PolarConnector, PolarConnectorConfig } from "../src/index";
import { makeTestPublisher } from "./helpers";

const customerWebhookPayload = {
  type: "customer.created",
  timestamp: "2024-01-01T00:00:00Z",
  data: {
    id: "cus_1",
    created_at: "2024-01-01T00:00:00Z",
    modified_at: null,
    deleted_at: null,
    external_id: null,
    email: "test@example.com",
    email_verified: true,
    name: "Test",
    organization_id: "org_1",
    avatar_url: "https://example.com/avatar.png",
    metadata: {},
    billing_address: null,
    tax_id: null,
  },
} as const;

const makeApiStub = (): PolarApiClientService => ({
  fetchJson: (_schema) => Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
  fetchList: (_schema) =>
    Effect.succeed({
      items: [],
      pagination: { total_count: 0, max_page: 1 },
    }),
});

describe("producer-polar webhook", () => {
  it.effect("publishes live webhook batches", () => {
    const runtimeLayer = NodeHttpServer.layerTest;
    const apiLayer = Layer.succeed(PolarApiClient)(makeApiStub());

    const connectorLayer = PolarConnectorConfig().pipe(Layer.provide(apiLayer));
    const configProvider = ConfigProvider.fromUnknown({
      POLAR_ACCESS_TOKEN: "test",
      POLAR_API_BASE_URL: "https://sandbox-api.polar.sh/v1/",
    });

    return Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* PolarConnector;
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
        const request = HttpClientRequest.post("/webhooks/polar").pipe(
          HttpClientRequest.bodyJsonUnsafe(customerWebhookPayload),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(200);

        yield* Deferred.await(done);
        const published = yield* Ref.get(publishedRef);
        expect(published.length).toBe(1);
        expect(published[0]?.name).toBe("customers");
      }).pipe(Effect.provide(runLayer));
    }).pipe(
      Effect.provide(connectorLayer),
      Effect.provide(runtimeLayer),
      Effect.provideService(ConfigProvider.ConfigProvider, configProvider),
      Effect.scoped,
    ) as Effect.Effect<void, ConnectorError, never>;
  });
});
