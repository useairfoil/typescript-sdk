import { HttpClient, HttpClientRequest, HttpServer } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  type Batch,
  buildWebhookRouter,
  ConnectorError,
  Publisher,
  runConnector,
  StateStoreInMemory,
} from "@useairfoil/connector-kit";
import { ConfigProvider, Deferred, Effect, Layer, Ref } from "effect";
import { PolarApiClient, type PolarApiClientService } from "../src/api";
import { PolarConnector, PolarConnectorConfig } from "../src/index";

type Published = {
  readonly name: string;
  readonly batch: Batch<Record<string, unknown>>;
};

const makeTestPublisher = (expected: number) =>
  Effect.gen(function* () {
    const publishedRef = yield* Ref.make<ReadonlyArray<Published>>([]);
    const done = yield* Deferred.make<number, never>();
    const layer = Layer.succeed(Publisher, {
      publish: ({ name, batch }) =>
        Effect.gen(function* () {
          const next = yield* Ref.updateAndGet(publishedRef, (items) => [
            ...items,
            { name, batch },
          ]);
          if (next.length === expected) {
            yield* Deferred.succeed(done, next.length);
          }
          return { success: true };
        }),
    });

    return { publishedRef, done, layer };
  });

const customerWebhookPayload = {
  type: "customer.created",
  timestamp: "2024-01-01T00:00:00Z",
  data: {
    id: "cus_1",
    created_at: "2024-01-01T00:00:00Z",
    modified_at: null,
    email: "test@example.com",
    name: "Test",
  },
} as const;

const makeApiStub = (): PolarApiClientService => ({
  fetchJson: () =>
    Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
  fetchList: () =>
    Effect.succeed({
      items: [],
      pagination: { total_count: 0, max_page: 1 },
    }),
});

describe("producer-polar webhook", () => {
  it.effect("publishes live webhook batches", () => {
    const runtimeLayer = NodeHttpServer.layerTest;

    const apiLayer = Layer.succeed(PolarApiClient, makeApiStub());
    const connectorLayer = PolarConnectorConfig().pipe(Layer.provide(apiLayer));
    const configProvider = ConfigProvider.fromMap(
      new Map([
        ["POLAR_ACCESS_TOKEN", "test"],
        ["POLAR_API_BASE_URL", "https://sandbox-api.polar.sh/v1/"],
      ]),
    );

    return Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* PolarConnector;

      const router = buildWebhookRouter(routes);
      yield* HttpServer.serveEffect(router);

      yield* Effect.forkScoped(
        runConnector(connector, new Date()).pipe(
          Effect.provide(StateStoreInMemory),
          Effect.provide(layer),
        ),
      );

      const client = yield* HttpClient.HttpClient;
      const request = HttpClientRequest.post("/webhooks/polar").pipe(
        HttpClientRequest.bodyUnsafeJson(customerWebhookPayload),
      );
      const response = yield* client.execute(request);

      expect(response.status).toBe(200);

      yield* Deferred.await(done);
      const published = yield* Ref.get(publishedRef);
      expect(published.length).toBe(1);
      expect(published[0]?.name).toBe("customers");
    }).pipe(
      Effect.provide(connectorLayer),
      Effect.provide(runtimeLayer),
      Effect.withConfigProvider(configProvider),
      Effect.scoped,
    );
  });
});
