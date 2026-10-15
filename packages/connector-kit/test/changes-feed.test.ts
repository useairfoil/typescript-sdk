import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Ref, Schema } from "effect";

import { Connector, Cursor, type CursorTypes, Fetch, Resource } from "../src/core";
import { ConnectorError } from "../src/errors";
import { identifier } from "../src/iceberg/annotations";
import { run } from "../src/ingestion/engine";
import { Ingestor, type IngestOptions } from "../src/ingestor/service";
import { layerMemory as StateStoreLayerMemory, StateStore } from "../src/state-store";
import { deriveSyncState } from "../src/state-store/state";

const RowSchema = Schema.Struct({
  id: Schema.String,
  updatedAt: Schema.String,
}).pipe(identifier("id"));

const makeResource = <const Name extends string>(name: Name) =>
  Resource.entity({
    name,
    rowSchema: RowSchema,
    version: "updatedAt",
    check: Effect.void,
  });

const Products = makeResource("products");
const Orders = makeResource("orders");

const ingestorLayer = (
  ingested: Ref.Ref<ReadonlyArray<IngestOptions>>,
  resourceNames?: ReadonlyArray<string>,
) =>
  Layer.succeed(Ingestor)({
    resourceNames,
    ingest: (options) => Ref.update(ingested, (current) => [...current, options]),
  });

// Runs the connector until `done` resolves, then returns ingests and state.
const runUntil = <A>(
  connector: Parameters<typeof run>[0],
  done: Deferred.Deferred<A>,
  resourceNames?: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const ingested = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);
    return yield* Effect.gen(function* () {
      const fiber = yield* Effect.forkScoped(
        run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
      );
      yield* Deferred.await(done);
      for (let i = 0; i < 5; i++) {
        yield* Effect.yieldNow;
      }
      const store = yield* StateStore;
      const state = {
        products: yield* store.getResourceState("products"),
        orders: yield* store.getResourceState("orders"),
      };
      yield* Fiber.interrupt(fiber);
      return {
        ingests: (yield* Ref.get(ingested)).map(({ resource, source, batch }) => ({
          resource,
          source,
          cursor: batch.cursor,
          rows: batch.rows,
        })),
        state,
      };
    }).pipe(
      Effect.scoped,
      Effect.provide(Layer.mergeAll(StateStoreLayerMemory, ingestorLayer(ingested, resourceNames))),
    );
  });

describe("changes feed", () => {
  it.effect("ingests rows for each resource and stores the cursor on every resource", () =>
    Effect.gen(function* () {
      const fetched = yield* Deferred.make<void>();
      const connector = Connector.define({
        name: "test",
        resources: [Products, Orders],
        changes: Fetch.feed({
          resources: [Products, Orders],
          cursor: Cursor.string(),
          fetch: ({ cursor }) =>
            Deferred.succeed(fetched, undefined).pipe(
              Effect.as({
                cursor: `after:${String(cursor)}`,
                rows: { products: [{ id: "p1", updatedAt: "2026-01-01T00:01:00Z" }] },
              }),
            ),
        }),
      });

      const result = yield* runUntil(connector, fetched);

      expect({
        ingests: result.ingests,
        cursors: {
          products: result.state.products?.changes?.cursor,
          orders: result.state.orders?.changes?.cursor,
        },
      }).toMatchInlineSnapshot(`
        {
          "cursors": {
            "orders": "after:2026-01-01T00:00:00Z",
            "products": "after:2026-01-01T00:00:00Z",
          },
          "ingests": [
            {
              "cursor": "after:2026-01-01T00:00:00Z",
              "resource": "products",
              "rows": [
                {
                  "id": "p1",
                  "updatedAt": "2026-01-01T00:01:00Z",
                },
              ],
              "source": "changes",
            },
            {
              "cursor": "after:2026-01-01T00:00:00Z",
              "resource": "orders",
              "rows": [],
              "source": "changes",
            },
          ],
        }
      `);
    }),
  );

  it.effect("fetches and ingests only the selected resources", () =>
    Effect.gen(function* () {
      const selected = yield* Deferred.make<ReadonlyArray<string>>();
      const connector = Connector.define({
        name: "test",
        resources: [Products, Orders],
        changes: Fetch.feed({
          resources: [Products, Orders],
          cursor: Cursor.string(),
          fetch: (input) =>
            Deferred.succeed(selected, [...input.selected]).pipe(
              Effect.as({
                cursor: "next",
                rows: {
                  products: [{ id: "p1", updatedAt: "2026-01-01T00:01:00Z" }],
                  orders: [{ id: "o1", updatedAt: "2026-01-01T00:01:00Z" }],
                },
              }),
            ),
        }),
      });

      const result = yield* runUntil(connector, selected, ["products"]);

      expect({
        selected: yield* Deferred.await(selected),
        ingested: result.ingests.map((ingest) => ingest.resource),
        ordersState: result.state.orders,
      }).toMatchInlineSnapshot(`
        {
          "ingested": [
            "products",
          ],
          "ordersState": undefined,
          "selected": [
            "products",
          ],
        }
      `);
    }),
  );

  it.effect("runs again without waiting when there is more", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(0);
      const secondCall = yield* Deferred.make<void>();
      const connector = Connector.define({
        name: "test",
        resources: [Products],
        changes: Fetch.feed({
          resources: [Products],
          cursor: Cursor.string(),
          interval: "1 hour",
          fetch: () =>
            Ref.updateAndGet(calls, (n) => n + 1).pipe(
              Effect.tap((n) => (n === 2 ? Deferred.succeed(secondCall, undefined) : Effect.void)),
              Effect.map((n) => ({ cursor: `page-${n}`, rows: {}, hasMore: n === 1 })),
            ),
        }),
      });

      const result = yield* runUntil(connector, secondCall);

      expect({
        calls: yield* Ref.get(calls),
        cursor: result.state.products?.changes?.cursor,
      }).toMatchInlineSnapshot(`
        {
          "calls": 2,
          "cursor": "page-2",
        }
      `);
    }),
  );

  it.effect("marks every resource as failed when the feed cannot fetch", () =>
    Effect.gen(function* () {
      const failed = yield* Deferred.make<void>();
      const connector = Connector.define({
        name: "test",
        resources: [Products, Orders],
        changes: Fetch.feed({
          resources: [Products, Orders],
          cursor: Cursor.string(),
          fetch: () =>
            Deferred.succeed(failed, undefined).pipe(
              Effect.andThen(Effect.fail(new ConnectorError({ message: "provider down" }))),
            ),
        }),
      });

      const result = yield* runUntil(connector, failed);

      expect({
        ingests: result.ingests.length,
        products: result.state.products?.lastError?.source,
        orders: result.state.orders?.lastError?.source,
      }).toMatchInlineSnapshot(`
        {
          "ingests": 0,
          "orders": "changes",
          "products": "changes",
        }
      `);
    }),
  );

  it.effect("marks every resource as failed when one resource cannot be ingested", () =>
    Effect.gen(function* () {
      const errorWritten = yield* Deferred.make<void>();
      const connector = Connector.define({
        name: "test",
        resources: [Products, Orders],
        changes: Fetch.feed({
          resources: [Products, Orders],
          cursor: Cursor.string(),
          fetch: ({ cursor }) =>
            Effect.succeed({
              cursor: `after:${String(cursor)}`,
              rows: { orders: [{ id: "o1", updatedAt: "2026-01-01T00:01:00Z" }] },
            }),
        }),
      });
      const failingIngestor = Layer.succeed(Ingestor)({
        ingest: ({ resource }) =>
          resource === "orders"
            ? Effect.fail(new ConnectorError({ message: "schema mismatch" }))
            : Effect.void,
      });
      const notifyingStore = Layer.effect(StateStore)(
        StateStore.pipe(
          Effect.provide(StateStoreLayerMemory),
          Effect.map((inner) => ({
            ...inner,
            setResourceError: (...args: Parameters<typeof inner.setResourceError>) =>
              inner
                .setResourceError(...args)
                .pipe(
                  Effect.andThen(
                    args[0] === "orders" ? Deferred.succeed(errorWritten, undefined) : Effect.void,
                  ),
                ),
          })),
        ),
      );

      const state = yield* Effect.gen(function* () {
        const fiber = yield* Effect.forkScoped(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        yield* Deferred.await(errorWritten);
        const store = yield* StateStore;
        const result = {
          products: yield* store.getResourceState("products"),
          orders: yield* store.getResourceState("orders"),
        };
        yield* Fiber.interrupt(fiber);
        return result;
      }).pipe(Effect.scoped, Effect.provide(Layer.mergeAll(notifyingStore, failingIngestor)));

      expect({
        products: state.products?.lastError && {
          source: state.products.lastError.source,
          operation: state.products.lastError.operation,
        },
        orders: state.orders?.lastError && {
          source: state.orders.lastError.source,
          operation: state.orders.lastError.operation,
        },
        cursorSaved: state.products?.changes !== undefined,
      }).toMatchInlineSnapshot(`
        {
          "cursorSaved": false,
          "orders": {
            "operation": "ingest",
            "source": "changes",
          },
          "products": {
            "operation": "ingest",
            "source": "changes",
          },
        }
      `);
    }),
  );

  it("reports a feed resource as pending until the feed checkpoints", () => {
    const connector = Connector.define({
      name: "test",
      resources: [Products, Orders],
      changes: Fetch.feed({
        resources: [Products],
        cursor: Cursor.string(),
        fetch: ({ cursor }) => Effect.succeed({ rows: {}, cursor }),
      }),
    });

    expect({
      products: deriveSyncState(connector, Products, undefined),
      orders: deriveSyncState(connector, Orders, undefined),
    }).toMatchInlineSnapshot(`
        {
          "orders": "live",
          "products": "pending",
        }
      `);
  });

  it.effect("resumes from a saved cursor when a new resource is added first", () =>
    Effect.gen(function* () {
      const fetched = yield* Deferred.make<CursorTypes.Value>();
      const connector = Connector.define({
        name: "test",
        resources: [Products, Orders],
        // Products is new and has no saved cursor yet.
        changes: Fetch.feed({
          resources: [Products, Orders],
          cursor: Cursor.string(),
          fetch: ({ cursor }) =>
            Deferred.succeed(fetched, cursor).pipe(Effect.andThen(Effect.never)),
        }),
      });

      const cursor = yield* Effect.gen(function* () {
        const store = yield* StateStore;
        yield* store.setChangesState("orders", { cursor: "saved-cursor" });
        const fiber = yield* Effect.forkScoped(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        const cursor = yield* Deferred.await(fetched);
        yield* Fiber.interrupt(fiber);
        return cursor;
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(
            StateStoreLayerMemory,
            ingestorLayer(yield* Ref.make<ReadonlyArray<IngestOptions>>([])),
          ),
        ),
      );

      expect(cursor).toMatchInlineSnapshot(`"saved-cursor"`);
    }),
  );

  it.effect("resumes from the oldest cursor when a resource fell behind", () =>
    Effect.gen(function* () {
      const fetched = yield* Deferred.make<CursorTypes.Value>();
      const connector = Connector.define({
        name: "test",
        resources: [Products, Orders],
        changes: Fetch.feed({
          resources: [Products, Orders],
          cursor: Cursor.string(),
          fetch: ({ cursor }) =>
            Deferred.succeed(fetched, cursor).pipe(Effect.andThen(Effect.never)),
        }),
      });

      const result = yield* Effect.gen(function* () {
        const store = yield* StateStore;
        // Orders wasn't selected while products moved on.
        yield* store.setChangesState("products", {
          cursor: "t2",
          lastSuccessAt: "2026-01-02T00:00:00.000Z",
        });
        yield* store.setBackfillState("orders", { cutoff: "t0", completed: true });
        yield* store.setChangesState("orders", {
          cursor: "t1",
          lastSuccessAt: "2026-01-01T00:00:00.000Z",
        });
        const fiber = yield* Effect.forkScoped(
          run(connector, { initialCutoff: "2026-01-03T00:00:00Z" }),
        );
        const cursor = yield* Deferred.await(fetched);
        yield* Fiber.interrupt(fiber);
        return { cursor, orders: yield* store.getResourceState("orders") };
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(
            StateStoreLayerMemory,
            ingestorLayer(yield* Ref.make<ReadonlyArray<IngestOptions>>([])),
          ),
        ),
      );

      expect({
        cursor: result.cursor,
        ordersBackfill: result.orders?.backfill,
      }).toMatchInlineSnapshot(`
        {
          "cursor": "t1",
          "ordersBackfill": {
            "completed": true,
            "cutoff": "t0",
          },
        }
      `);
    }),
  );

  it.effect("rejects a resource listed twice in the feed", () =>
    Effect.gen(function* () {
      const connector = Connector.define({
        name: "test",
        resources: [Products],
        changes: Fetch.feed({
          resources: [Products, Products],
          cursor: Cursor.string(),
          fetch: ({ cursor }) => Effect.succeed({ rows: {}, cursor }),
        }),
      });

      const error = yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }).pipe(
        Effect.flip,
        Effect.provide(
          Layer.mergeAll(
            StateStoreLayerMemory,
            ingestorLayer(yield* Ref.make<ReadonlyArray<IngestOptions>>([])),
          ),
        ),
      );

      expect(error.message).toMatchInlineSnapshot(
        `"Resource products is in the changes feed twice"`,
      );
    }),
  );

  it.effect("rejects a feed resource that has its own changes", () =>
    Effect.gen(function* () {
      const WithChanges = Resource.entity({
        name: "products",
        rowSchema: RowSchema,
        version: "updatedAt",
        check: Effect.void,
        changes: Fetch.changes({
          cursor: Cursor.string(),
          fetch: ({ cursor }) => Effect.succeed({ rows: [], cursor }),
        }),
      });
      const connector = Connector.define({
        name: "test",
        resources: [WithChanges],
        changes: Fetch.feed({
          resources: [WithChanges],
          cursor: Cursor.string(),
          fetch: ({ cursor }) => Effect.succeed({ rows: {}, cursor }),
        }),
      });

      const error = yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }).pipe(
        Effect.flip,
        Effect.provide(
          Layer.mergeAll(
            StateStoreLayerMemory,
            ingestorLayer(yield* Ref.make<ReadonlyArray<IngestOptions>>([])),
          ),
        ),
      );

      expect(error.message).toMatchInlineSnapshot(
        `"Resource products has its own changes and is also in the changes feed"`,
      );
    }),
  );
});
