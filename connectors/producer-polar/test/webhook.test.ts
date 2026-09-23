import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConnectorError, Ingestion, StateStore } from "@useairfoil/connector-kit";
import {
  ConfigProvider,
  DateTime,
  Deferred,
  Effect,
  Encoding,
  Layer,
  Option,
  Ref,
  Schema,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { Webhook as StandardWebhook } from "standardwebhooks";

import type { PolarApiClientService } from "../src/api";

import { PolarApiClient, PolarConnector, WebhookPayloadSchema } from "../src/index";
import { makeTestIngestor } from "./helpers";

const webhookSecret = "test-webhook-secret";

const customerWebhookPayload = {
  type: "customer.created",
  timestamp: "2024-01-01T00:00:00Z",
  data: {
    id: "cus_1",
    created_at: "2024-01-01T00:00:00Z",
    modified_at: null,
    type: "individual",
    deleted_at: null,
    external_id: null,
    email: "test@example.com",
    email_verified: true,
    name: "Test",
    billing_name: null,
    organization_id: "org_1",
    avatar_url: "https://example.com/avatar.png",
    metadata: {},
    billing_address: null,
    tax_id: null,
  },
};

const signPayload = (rawBody: string) => {
  const now = new Date();
  const webhookId = "webhook_1";
  const base64Secret = Encoding.encodeBase64(webhookSecret);
  const verifier = new StandardWebhook(base64Secret);
  return {
    "webhook-id": webhookId,
    "webhook-timestamp": String(Math.floor(now.getTime() / 1000)),
    "webhook-signature": verifier.sign(webhookId, now, rawBody),
  };
};

const makeApiStub = (): PolarApiClientService => ({
  fetchJson: (_schema) => Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
  fetchList: (_schema) =>
    Effect.succeed({
      items: [],
      pagination: { total_count: 0, max_page: 1 },
    }),
});

const connectorTestLayer = Layer.effect(PolarConnector.PolarConnector)(
  PolarConnector.PolarConfigDef.config.pipe(Effect.flatMap(PolarConnector.make)),
).pipe(
  Layer.provide(Layer.succeed(PolarApiClient.PolarApiClient)(makeApiStub())),
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        POLAR_ACCESS_TOKEN: "test",
        POLAR_API_BASE_URL: "https://sandbox-api.polar.sh/v1/",
        POLAR_WEBHOOK_SECRET: webhookSecret,
      }),
    ),
  ),
);

describe("producer-polar webhook", () => {
  it.effect("ingests live webhook batches", () =>
    Effect.gen(function* () {
      const { ingestedRef, done, layer } = yield* makeTestIngestor(5);
      const connector = yield* PolarConnector.PolarConnector;
      const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes: connector.webhooks ?? [],
            },
          }),
        );

        const rawBody = JSON.stringify(customerWebhookPayload);
        const headers = signPayload(rawBody);
        const client = yield* HttpClient.HttpClient;
        const request = HttpClientRequest.post("/webhooks/polar").pipe(
          HttpClientRequest.setHeaders(headers),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(200);

        yield* Deferred.await(done);
        const ingested = yield* Ref.get(ingestedRef);
        const webhookIngest = ingested.find(
          (item) => item.source === "webhook" && item.resource === "customers",
        );

        expect(webhookIngest).toMatchObject({
          resource: "customers",
          batch: {
            rows: [{ id: "cus_1", version: new Date(customerWebhookPayload.timestamp) }],
          },
        });
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );

  it.effect("turns customer.deleted into a soft delete", () =>
    Effect.gen(function* () {
      const connector = yield* PolarConnector.PolarConnector;
      const webhook = yield* Effect.fromOption(
        Option.fromNullishOr(connector.resources[0].webhook),
      );
      const payload = yield* Schema.decodeUnknownEffect(WebhookPayloadSchema)({
        ...customerWebhookPayload,
        type: "customer.deleted",
      });

      if (payload.type !== "customer.deleted") {
        return yield* Effect.die("Expected a customer.deleted payload");
      }

      const rows = yield* webhook.handler({ payload });

      expect(rows).toEqual([
        {
          id: customerWebhookPayload.data.id,
          version: new Date(customerWebhookPayload.timestamp),
          _af_deleted: true,
        },
      ]);
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );

  it.effect("rejects invalid webhook signatures", () =>
    Effect.gen(function* () {
      const { ingestedRef, layer } = yield* makeTestIngestor(1);
      const connector = yield* PolarConnector.PolarConnector;
      const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

      yield* Effect.gen(function* () {
        yield* Effect.forkScoped(
          Ingestion.run(connector, {
            initialCutoff: now,
            webhook: {
              routes: connector.webhooks ?? [],
            },
          }),
        );

        const rawBody = JSON.stringify(customerWebhookPayload);
        const headers = signPayload(`${rawBody}-invalid`);
        const client = yield* HttpClient.HttpClient;
        const request = HttpClientRequest.post("/webhooks/polar").pipe(
          HttpClientRequest.setHeaders(headers),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        );
        const response = yield* client.execute(request);

        expect(response.status).toBe(401);
        const ingested = yield* Ref.get(ingestedRef);

        expect(ingested.some((item) => item.source === "webhook")).toBe(false);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.provide(connectorTestLayer), Effect.scoped),
  );
});
