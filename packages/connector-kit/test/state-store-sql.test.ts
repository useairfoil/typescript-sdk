import type { StartedTestContainer } from "testcontainers";

import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Context, Effect, Layer, Redacted } from "effect";
import { GenericContainer, Wait } from "testcontainers";

import { PlatformRuntimeKey } from "../src/runtime-config/constants";
import { layerSql, StateStore } from "../src/state-store";

class PostgresContainer extends Context.Service<PostgresContainer, StartedTestContainer>()(
  "test/PostgresContainer",
) {}

const PostgresContainerLive = Layer.effect(
  PostgresContainer,
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () =>
        new GenericContainer("postgres:17")
          .withEnvironment({
            POSTGRES_PASSWORD: "postgres",
            POSTGRES_DB: "test",
            POSTGRES_USER: "postgres",
          })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .withStartupTimeout(60_000)
          .start(),
      catch: (cause) => new Error(`Failed to start PostgreSQL: ${cause}`),
    }),
    (container) => Effect.promise(() => container.stop()).pipe(Effect.orDie),
  ),
);

const PostgresLive = Layer.unwrap(
  Effect.gen(function* () {
    const container = yield* PostgresContainer;
    const host = container.getHost();
    const port = container.getMappedPort(5432);
    return PgClient.layer({
      url: Redacted.make(`postgresql://postgres:postgres@${host}:${port}/test`),
      maxConnections: 2,
    });
  }),
).pipe(Layer.provide(PostgresContainerLive));

const stateLayer = (connectorInstanceId: string) =>
  layerSql().pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          [PlatformRuntimeKey.connectorInstanceId]: connectorInstanceId,
          [PlatformRuntimeKey.stateTable]: "test_airfoil_connector_state",
        }),
      ),
    ),
  );

describe("SQL state store", () => {
  it.effect(
    "persists through layer recreation and isolates connector instances in one table",
    () =>
      Effect.gen(function* () {
        const firstId = "team-acme:producer/shopify#primary";
        const secondId = "team-globex:producer/shopify#primary";

        yield* Effect.gen(function* () {
          const store = yield* StateStore;
          yield* store.setBackfillState("products", {
            cutoff: "2026-07-17T00:00:00.000Z",
            pageCursor: "page-2",
            completed: false,
          });
        }).pipe(Effect.provide(stateLayer(firstId)));

        yield* Effect.gen(function* () {
          const store = yield* StateStore;
          expect(yield* store.getResourceState("products")).toBeUndefined();
          yield* store.setChangesState("products", { cursor: 101 });
        }).pipe(Effect.provide(stateLayer(secondId)));

        const restoredFirst = yield* Effect.gen(function* () {
          const store = yield* StateStore;
          return yield* store.getResourceState("products");
        }).pipe(Effect.provide(stateLayer(firstId)));

        const restoredSecond = yield* Effect.gen(function* () {
          const store = yield* StateStore;
          return yield* store.getResourceState("products");
        }).pipe(Effect.provide(stateLayer(secondId)));

        expect(restoredFirst).toEqual({
          backfill: {
            cutoff: "2026-07-17T00:00:00.000Z",
            pageCursor: "page-2",
            completed: false,
          },
        });
        expect(restoredSecond).toEqual({ changes: { cursor: 101 } });
      }).pipe(Effect.provide(PostgresLive)),
    60_000,
  );
});
