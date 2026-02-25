import { access } from "node:fs/promises";
import * as Path from "node:path";
import { HttpClient, HttpClientRequest, HttpServer } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { expect, it as vitest } from "@effect/vitest";
import {
  type Batch,
  buildWebhookRouter,
  ConnectorError,
  Publisher,
  runConnector,
  StateStoreInMemory,
} from "@useairfoil/connector-kit";
import { Deferred, Effect, Layer, Ref } from "effect";
import { describe } from "vitest";
import type { PolarApiClient } from "../src/api";
import { makePolarConnector } from "../src/index";

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

const makeApiStub = (): PolarApiClient => ({
  fetchJson: () =>
    Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
  fetchList: () =>
    Effect.succeed({
      items: [],
      pagination: { total_count: 0, max_page: 1 },
    }),
});

describe("producer-polar", () => {
  vitest.effect("publishes live webhook batches", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      const { connector, routes } = yield* makePolarConnector(
        {
          accessToken: "test",
        },
        { api: makeApiStub() },
      );

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
    }).pipe(Effect.provide(NodeHttpServer.layerTest), Effect.scoped),
  );

  vitest.effect("replays backfill with VCR", () =>
    Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(2);
      const cassetteDir = Path.join(process.cwd(), "cassettes");
      const cassettePath = Path.join(
        cassetteDir,
        "customers-backfill-replay.json",
      );
      const accessToken = process.env.POLAR_ACCESS_TOKEN;
      if (!accessToken) {
        const exists = yield* Effect.tryPromise({
          try: () =>
            access(cassettePath)
              .then(() => true)
              .catch(() => false),
          catch: () => false,
        });
        if (!exists) {
          return yield* Effect.fail(
            new Error(
              "missing POLAR_ACCESS_TOKEN for vcr record; run with `POLAR_ACCESS_TOKEN=...` or `bun --env-file=.env`",
            ),
          );
        }
      }
      const { connector, routes } = yield* makePolarConnector(
        { accessToken: accessToken ?? "test" },
        {
          vcr: {
            cassetteDir,
            cassetteName: "customers-backfill-replay",
            mode: "auto",
            matchIgnore: {
              requestHeaders: ["authorization"],
            },
            redact: {
              requestHeaders: ["authorization"],
            },
          },
        },
      );

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
      expect(published.length).toBe(2);
      expect(published[0]?.name).toBe("customers");
      expect(published[1]?.name).toBe("customers");
    }).pipe(Effect.provide(NodeHttpServer.layerTest), Effect.scoped),
  );
});
