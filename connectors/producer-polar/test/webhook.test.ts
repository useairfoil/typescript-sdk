import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConnectorError, Ingestion } from "@useairfoil/connector-kit";
import { Config, ConfigProvider, DateTime, Deferred, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { PolarApiClientService } from "../src/api";

import { PolarApiClient, PolarConnector } from "../src/index";
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
  it.effect("publishes live webhook batches", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* PolarConnector.PolarConnector;
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
        const request = HttpClientRequest.post("/webhooks/polar").pipe(
          HttpClientRequest.bodyJsonUnsafe(customerWebhookPayload),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(200);

        yield* Deferred.await(done);
        const published = yield* Ref.get(publishedRef);
        expect(published.length).toBe(1);
        expect(published[0]?.name).toBe("customers");
      }).pipe(
        Effect.provide(Layer.mergeAll(Ingestion.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(
      Effect.provide(
        Layer.effect(PolarConnector.PolarConnector)(
          Config.unwrap(PolarConnector.PolarConfigConfig)
            .asEffect()
            .pipe(Effect.flatMap(PolarConnector.make)),
        ).pipe(
          Layer.provide(Layer.succeed(PolarApiClient.PolarApiClient)(makeApiStub())),
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
