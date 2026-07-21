import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Ref, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpRouter,
  HttpServerResponse,
} from "effect/unstable/http";

import { Connector, Cursor, Fetch, Resource } from "../src/core";
import { ConnectorError } from "../src/errors";
import { run } from "../src/ingestion/engine";
import { Publisher, type PublishOptions } from "../src/publisher/service";
import { layerMemory as StateStoreLayerMemory, StateStore } from "../src/state-store";
import * as Status from "../src/status";
import * as Webhook from "../src/webhook";

const TestRowSchema = Schema.Struct({
  id: Schema.String,
  updatedAt: Schema.String,
});

const TestPayloadSchema = Schema.Struct({
  id: Schema.String,
  updatedAt: Schema.String,
});

// Records publish calls and lets happy-path tests wait until publishing completes.
const makePublisherLayer = (
  publishedRef: Ref.Ref<ReadonlyArray<PublishOptions>>,
  expectedPublishes = 0,
) =>
  Effect.gen(function* () {
    const done = yield* Deferred.make<void>();
    let count = 0;
    const layer = Layer.succeed(Publisher)({
      publish: (options) =>
        Ref.update(publishedRef, (published) => [...published, options]).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              count += 1;
            }),
          ),
          Effect.tap(() =>
            count >= expectedPublishes ? Deferred.succeed(done, undefined) : Effect.void,
          ),
          Effect.as({ status: "accepted" as const, resource: options.resource }),
        ),
    });
    return { done, layer };
  });

// Webhook runtime is long-lived, so tests run it in a scoped fiber.
const startConnector = (connector: ReturnType<typeof Connector.define>) =>
  Effect.forkScoped(
    run(connector, {
      initialCutoff: "2026-01-01T00:00:00.000Z",
      webhook: { routes: connector.webhooks ?? [] },
    }),
  );

describe("webhook server", () => {
  it.effect("returns 400 for invalid JSON", () =>
    Effect.gen(function* () {
      const route = Webhook.route({
        path: "/webhooks/test",
        ackMode: "after-publish",
        schema: TestPayloadSchema,
        handler: () => Effect.succeed(HttpServerResponse.jsonUnsafe({ ok: true })),
      });
      const connector = Connector.define({ name: "test", resources: [], webhooks: [route] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);
      const { layer } = yield* makePublisherLayer(publishedRef);

      yield* Effect.gen(function* () {
        yield* startConnector(connector);
        const client = yield* HttpClient.HttpClient;
        const response = yield* client.execute(
          HttpClientRequest.post("/webhooks/test").pipe(
            HttpClientRequest.bodyText("{bad", "application/json"),
          ),
        );

        expect(response.status).toBe(400);
        expect(yield* Ref.get(publishedRef)).toHaveLength(0);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStoreLayerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.scoped),
  );

  it.effect("serves prometheus metrics including webhook outcomes", () =>
    Effect.gen(function* () {
      const route = Webhook.route({
        path: "/webhooks/test",
        ackMode: "after-publish",
        schema: TestPayloadSchema,
        handler: () => Effect.succeed(HttpServerResponse.jsonUnsafe({ ok: true })),
      });
      const connector = Connector.define({ name: "test", resources: [], webhooks: [route] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);
      const { layer } = yield* makePublisherLayer(publishedRef);

      yield* Effect.gen(function* () {
        yield* startConnector(connector);
        const client = yield* HttpClient.HttpClient;
        yield* client.execute(
          HttpClientRequest.post("/webhooks/test").pipe(
            HttpClientRequest.bodyText("{bad", "application/json"),
          ),
        );
        const response = yield* client.execute(HttpClientRequest.get("/metrics"));
        const body = yield* response.text;

        expect(response.status).toBe(200);
        expect(body).toContain("airfoil_connector_webhook_requests_total");
        expect(body).toContain('outcome="invalid_json"');
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStoreLayerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.scoped),
  );

  it.effect("serves resource sync status", () =>
    Effect.gen(function* () {
      const resource = Resource.entity({
        name: "products",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              mutations: [],
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource], webhooks: [] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);
      const { done, layer } = yield* makePublisherLayer(publishedRef, 1);

      yield* Effect.gen(function* () {
        yield* startConnector(connector);
        yield* Deferred.await(done);
        const client = yield* HttpClient.HttpClient;
        const response = yield* client.execute(HttpClientRequest.get("/status"));
        const text = yield* response.text;

        expect(response.status, text).toBe(200);
        const body = yield* Schema.decodeUnknownEffect(Status.StatusResponseSchema)(
          JSON.parse(text),
        );
        expect(body).toMatchInlineSnapshot(`
          {
            "connector": "test",
            "resources": [
              {
                "backfill": {
                  "completed": true,
                  "cutoff": "2026-01-01T00:00:00.000Z",
                },
                "name": "products",
                "state": "live",
              },
            ],
          }
        `);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStoreLayerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.scoped),
  );

  it.effect(
    "returns a generic 500 and does not leak internal error detail when status computation fails",
    () =>
      Effect.gen(function* () {
        const resource = Resource.entity({
          name: "products",
          schema: TestRowSchema,
          key: "id",
          version: "updatedAt",
          check: Effect.void,
          backfill: Fetch.page({
            pageCursor: Cursor.string(),
            cutoff: Cursor.isoDateTime(),
            fetch: () => Effect.succeed({ mutations: [], hasMore: false }),
          }),
        });
        const connector = Connector.define({ name: "test", resources: [resource], webhooks: [] });
        const failingStateStoreLayer = Layer.succeed(StateStore)({
          getResourceState: () =>
            Effect.fail(new ConnectorError({ message: "super secret internal detail" })),
          setBackfillState: () => Effect.void,
          setChangesState: () => Effect.void,
          setResourceError: () => Effect.void,
          clearResourceError: () => Effect.void,
        });

        yield* Effect.gen(function* () {
          const client = yield* HttpClient.HttpClient;
          const response = yield* client.execute(HttpClientRequest.get("/status"));
          const text = yield* response.text;

          expect(response.status).toBe(500);
          expect(text).not.toContain("super secret internal detail");
          expect(JSON.parse(text)).toMatchInlineSnapshot(`
            {
              "error": "Failed to compute status",
              "ok": false,
            }
          `);
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              HttpRouter.serve(Status.statusRoute(connector), { disableLogger: true }).pipe(
                Layer.provide(Layer.mergeAll(NodeHttpServer.layerTest, failingStateStoreLayer)),
              ),
              NodeHttpServer.layerTest,
            ),
          ),
        );
      }).pipe(Effect.scoped),
  );

  it.effect("reports webhook-only resources as live, not stuck backfilling", () =>
    Effect.gen(function* () {
      const route = Webhook.route({
        path: "/webhooks/test",
        ackMode: "after-publish",
        schema: TestPayloadSchema,
        handler: ({ to, payload }) =>
          to(resource, payload).pipe(Effect.as(HttpServerResponse.jsonUnsafe({ ok: true }))),
      });
      const resource = Resource.entity({
        name: "events",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        webhook: {
          schema: TestPayloadSchema,
          handler: ({ payload }) => Effect.succeed([Resource.upsert(payload)]),
        },
      });
      const connector = Connector.define({
        name: "test",
        resources: [resource],
        webhooks: [route],
      });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);
      const { layer } = yield* makePublisherLayer(publishedRef);

      yield* Effect.gen(function* () {
        yield* startConnector(connector);
        const client = yield* HttpClient.HttpClient;
        const response = yield* client.execute(HttpClientRequest.get("/status"));
        const text = yield* response.text;

        expect(response.status, text).toBe(200);
        const body = yield* Schema.decodeUnknownEffect(Status.StatusResponseSchema)(
          JSON.parse(text),
        );
        const eventsStatus = body.resources.find((r) => r.name === "events");
        expect(eventsStatus).toMatchInlineSnapshot(`
          {
            "name": "events",
            "state": "live",
          }
        `);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStoreLayerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.scoped),
  );

  it.effect("returns 400 for invalid route payload", () =>
    Effect.gen(function* () {
      const route = Webhook.route({
        path: "/webhooks/test",
        ackMode: "after-publish",
        schema: TestPayloadSchema,
        handler: () => Effect.succeed(HttpServerResponse.jsonUnsafe({ ok: true })),
      });
      const connector = Connector.define({ name: "test", resources: [], webhooks: [route] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);
      const { layer } = yield* makePublisherLayer(publishedRef);

      yield* Effect.gen(function* () {
        yield* startConnector(connector);
        const client = yield* HttpClient.HttpClient;
        const response = yield* client.execute(
          HttpClientRequest.post("/webhooks/test").pipe(
            HttpClientRequest.bodyJsonUnsafe({ id: 123, updatedAt: "2026-01-01T00:00:00.000Z" }),
          ),
        );

        expect(response.status).toBe(400);
        expect(yield* Ref.get(publishedRef)).toHaveLength(0);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStoreLayerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.scoped),
  );

  it.effect("publishes resource webhook mutations after to", () =>
    Effect.gen(function* () {
      const Products = Resource.entity({
        name: "products",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        webhook: Resource.webhook({
          schema: TestPayloadSchema,
          handler: ({ payload }) => Effect.succeed([Resource.upsert(payload)]),
        }),
      });
      const route = Webhook.route({
        path: "/webhooks/test",
        ackMode: "after-publish",
        schema: TestPayloadSchema,
        handler: ({ payload, to }) =>
          to(Products, payload).pipe(Effect.as(HttpServerResponse.jsonUnsafe({ ok: true }))),
      });
      const connector = Connector.define({
        name: "test",
        resources: [Products],
        webhooks: [route],
      });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);
      const { done, layer } = yield* makePublisherLayer(publishedRef, 1);

      yield* Effect.gen(function* () {
        yield* startConnector(connector);
        const client = yield* HttpClient.HttpClient;
        const response = yield* client.execute(
          HttpClientRequest.post("/webhooks/test").pipe(
            HttpClientRequest.bodyJsonUnsafe({ id: "p1", updatedAt: "2026-01-01T00:00:00.000Z" }),
          ),
        );

        expect(response.status).toBe(200);
        yield* Deferred.await(done);
        const published = yield* Ref.get(publishedRef);
        expect({
          source: published[0]?.source,
          resource: published[0]?.resource,
          mutationCount: published[0]?.batch.mutations.length,
        }).toMatchInlineSnapshot(`
          {
            "mutationCount": 1,
            "resource": "products",
            "source": "webhook",
          }
        `);

        const metricsResponse = yield* client.execute(HttpClientRequest.get("/metrics"));
        const metricsBody = yield* metricsResponse.text;
        expect(metricsBody).toContain("airfoil_connector_entities_upserted_total");
        expect(metricsBody).toContain('source="webhook"');
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStoreLayerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.scoped),
  );
});
