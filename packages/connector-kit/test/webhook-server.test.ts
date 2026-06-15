import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Ref, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpServerResponse } from "effect/unstable/http";

import { Connector, Resource } from "../src/core";
import { run } from "../src/ingestion/engine";
import { Publisher, type PublishOptions } from "../src/publisher/service";
import * as StateStore from "../src/state-store";
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
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
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
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
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
        expect(published[0]?.source).toBe("webhook");
        expect(published[0]?.resource).toBe("products");
        expect(published[0]?.batch.mutations).toHaveLength(1);
      }).pipe(
        Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
      );
    }).pipe(Effect.scoped),
  );
});
