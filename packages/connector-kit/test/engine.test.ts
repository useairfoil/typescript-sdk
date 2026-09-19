import { describe, expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Metric, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

import { Connector, Cursor, Fetch, Resource, type ResourceUpdate } from "../src/core";
import { ConnectorError } from "../src/errors";
import { run } from "../src/ingestion/engine";
import { Ingestor, type IngestOptions } from "../src/ingestor/service";
import * as Metrics from "../src/metrics";
import { layerMemory as StateStoreLayerMemory, StateStore } from "../src/state-store";
import { Attr } from "../src/telemetry";

type TestRow = { readonly id: string; readonly updatedAt: string; readonly value: string };

const TestRowSchema = Schema.Struct({
  id: Schema.String,
  updatedAt: Schema.String,
  value: Schema.String,
});

// @ts-expect-error partial updates must include the version field
const missingVersion: ResourceUpdate<typeof TestRowSchema, "id", "updatedAt"> = { id: "p1" };
void missingVersion;

const InvalidIdentitySchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  version: Schema.NullOr(Schema.String),
});

Resource.entity({
  name: "invalid-identity",
  rowSchema: InvalidIdentitySchema,
  // @ts-expect-error entity keys must be required and non-null
  key: "id",
  // @ts-expect-error entity versions must be required and non-null
  version: "version",
  check: Effect.void,
});

Resource.entity({
  name: "primitive",
  // @ts-expect-error resource schemas must decode object rows with fields
  rowSchema: Schema.String,
  key: "id",
  version: "id",
  check: Effect.void,
});

// Delegates to the real in-memory StateStore, intercepting checkpoint writes.
const layerMemoryNotifyingOnSet = (onSet: () => Effect.Effect<void>) =>
  Layer.effect(StateStore)(
    StateStore.pipe(
      Effect.provide(StateStoreLayerMemory),
      Effect.map((inner) => ({
        ...inner,
        setBackfillState: (...args: Parameters<typeof inner.setBackfillState>) =>
          inner.setBackfillState(...args).pipe(Effect.andThen(onSet())),
        setChangesState: (...args: Parameters<typeof inner.setChangesState>) =>
          inner.setChangesState(...args).pipe(Effect.andThen(onSet())),
      })),
    ),
  );

const layerMemoryNotifyingOnError = (onError: () => Effect.Effect<void>) =>
  Layer.effect(StateStore)(
    StateStore.pipe(
      Effect.provide(StateStoreLayerMemory),
      Effect.map((inner) => ({
        ...inner,
        setResourceError: (...args: Parameters<typeof inner.setResourceError>) =>
          inner.setResourceError(...args).pipe(Effect.andThen(onError())),
      })),
    ),
  );

const layerMemoryNotifyingOnBackfillClear = (onClear: () => Effect.Effect<void>) =>
  Layer.effect(StateStore)(
    StateStore.pipe(
      Effect.provide(StateStoreLayerMemory),
      Effect.map((inner) => ({
        ...inner,
        clearResourceError: (...args: Parameters<typeof inner.clearResourceError>) =>
          inner
            .clearResourceError(...args)
            .pipe(Effect.andThen(args[1] === "backfill" ? onClear() : Effect.void)),
      })),
    ),
  );

const makeIngestorLayer = (
  ingestedRef: Ref.Ref<ReadonlyArray<IngestOptions>>,
  ingest: (options: IngestOptions) => Effect.Effect<void, ConnectorError>,
) =>
  Layer.succeed(Ingestor)({
    ingest: (options) =>
      Ref.update(ingestedRef, (ingested) => [...ingested, options]).pipe(
        Effect.andThen(ingest(options)),
      ),
  });

const runtimeLayer = (
  stateStoreLayer: Layer.Layer<StateStore>,
  ingestorLayer: Layer.Layer<Ingestor>,
) => Layer.mergeAll(stateStoreLayer, ingestorLayer);

describe("resource ingestion engine", () => {
  it.effect("checkpoints backfill only after successful ingestion", () =>
    Effect.gen(function* () {
      const row: TestRow = { id: "p1", updatedAt: "2026-01-01T00:00:00Z", value: "one" };
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              rows: [row],
              nextPageCursor: "page-2",
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const state = yield* Effect.gen(function* () {
        yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" });
        return yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
      }).pipe(
        Effect.provide(
          runtimeLayer(
            StateStoreLayerMemory,
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
      );

      const ingested = yield* Ref.get(ingestedRef);

      expect({
        ingestedCount: ingested.length,
        rowCount: ingested[0]?.batch.rows.length,
        backfill: state?.backfill,
      }).toMatchInlineSnapshot(`
        {
          "backfill": {
            "completed": true,
            "cutoff": "2026-01-01T00:00:00Z",
            "lastSuccessAt": "1970-01-01T00:00:00.000Z",
            "pageCursor": "page-2",
          },
          "ingestedCount": 1,
          "rowCount": 1,
        }
      `);
    }),
  );

  it.effect("clears a stale backfill error when completion was already checkpointed", () =>
    Effect.gen(function* () {
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () => Effect.die("completed backfill must not fetch again"),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const state = yield* Effect.gen(function* () {
        const store = yield* StateStore;
        yield* store.setBackfillState("products", {
          cutoff: "2026-01-01T00:00:00Z",
          completed: true,
          lastSuccessAt: "2026-01-01T00:01:00.000Z",
        });
        yield* store.setResourceError("products", "backfill", "checkpoint");

        yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" });
        const state = yield* store.getResourceState("products");
        const lastSuccess = yield* Metric.value(
          Metric.withAttributes(Metrics.lastSuccessTimestamp, {
            [Attr.connectorName]: "test",
            [Attr.resourceName]: "products",
            [Attr.resourceSource]: "backfill",
          }),
        );
        return { state, lastSuccess: lastSuccess.value };
      }).pipe(
        Effect.provide(
          runtimeLayer(
            StateStoreLayerMemory,
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
      );

      expect(state).toEqual({
        state: {
          backfill: {
            cutoff: "2026-01-01T00:00:00Z",
            completed: true,
            lastSuccessAt: "2026-01-01T00:01:00.000Z",
          },
        },
        lastSuccess: 1_767_225_660,
      });
      expect(yield* Ref.get(ingestedRef)).toEqual([]);
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map())),
  );

  it.effect("clears a completed backfill error hidden by a newer changes error", () =>
    Effect.gen(function* () {
      const backfillErrorCleared = yield* Deferred.make<void>();
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () => Effect.die("completed backfill must not fetch again"),
        }),
        changes: Fetch.changes({
          cursor: Cursor.isoDateTime(),
          fetch: () => Effect.never,
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const state = yield* Effect.gen(function* () {
        const store = yield* StateStore;
        yield* store.setBackfillState("products", {
          cutoff: "2026-01-01T00:00:00Z",
          completed: true,
        });
        yield* store.setResourceError("products", "backfill", "checkpoint");
        yield* TestClock.adjust("1 millis");
        yield* store.setResourceError("products", "changes", "fetch");

        const fiber = yield* Effect.forkScoped(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        yield* Deferred.await(backfillErrorCleared);
        const state = yield* store.getResourceState("products");
        yield* Fiber.interrupt(fiber);
        return state;
      }).pipe(
        Effect.scoped,
        Effect.provide(
          runtimeLayer(
            layerMemoryNotifyingOnBackfillClear(() =>
              Deferred.succeed(backfillErrorCleared, undefined),
            ),
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
      );

      expect(state?.lastError).toMatchObject({
        source: "changes",
        operation: "fetch",
      });
      expect(yield* Ref.get(ingestedRef)).toEqual([]);
    }),
  );

  it.effect("does not checkpoint when ingestion fails", () =>
    Effect.gen(function* () {
      const errorWritten = yield* Deferred.make<void>();
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              rows: [{ id: "p1", updatedAt: "2026-01-01T00:00:00Z", value: "one" }],
              nextPageCursor: "page-2",
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const { running, state } = yield* Effect.gen(function* () {
        const fiber = yield* Effect.forkScoped(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        yield* Deferred.await(errorWritten);
        const running = fiber.pollUnsafe() === undefined;
        const state = yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
        yield* Fiber.interrupt(fiber);
        return { running, state };
      }).pipe(
        Effect.scoped,
        Effect.provide(
          runtimeLayer(
            layerMemoryNotifyingOnError(() => Deferred.succeed(errorWritten, undefined)),
            makeIngestorLayer(ingestedRef, () =>
              Effect.fail(new ConnectorError({ message: "schema mismatch" })),
            ),
          ),
        ),
      );

      expect({
        running,
        backfill: state?.backfill,
        changes: state?.changes,
        lastError: state?.lastError && {
          source: state.lastError.source,
          operation: state.lastError.operation,
          code: state.lastError.code,
          message: state.lastError.message,
        },
      }).toMatchInlineSnapshot(`
        {
          "backfill": undefined,
          "changes": undefined,
          "lastError": {
            "code": "ingest_failed",
            "message": "Backfill ingestion failed",
            "operation": "ingest",
            "source": "backfill",
          },
          "running": true,
        }
      `);
    }),
  );

  it.effect("advances backfill state for empty ingested pages", () =>
    Effect.gen(function* () {
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              rows: [],
              nextPageCursor: "empty-page",
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const state = yield* Effect.gen(function* () {
        yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" });
        return yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
      }).pipe(
        Effect.provide(
          runtimeLayer(
            StateStoreLayerMemory,
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
      );

      expect(state?.backfill).toMatchInlineSnapshot(`
        {
          "completed": true,
          "cutoff": "2026-01-01T00:00:00Z",
          "lastSuccessAt": "1970-01-01T00:00:00.000Z",
          "pageCursor": "empty-page",
        }
      `);
    }),
  );

  it.effect("checkpoints changes cursor after successful ingestion", () =>
    Effect.gen(function* () {
      const stateWritten = yield* Deferred.make<void>();
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        changes: Fetch.changes({
          cursor: Cursor.isoDateTime(),
          interval: "1 minute",
          fetch: () =>
            Effect.succeed({
              rows: [{ id: "p1", updatedAt: "2026-01-01T00:01:00Z", value: "one" }],
              cursor: "2026-01-01T00:01:00Z",
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const state = yield* Effect.gen(function* () {
        const fiber = yield* Effect.forkScoped(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        yield* Deferred.await(stateWritten);
        yield* Fiber.interrupt(fiber);
        return yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
      }).pipe(
        Effect.scoped,
        Effect.provide(
          runtimeLayer(
            layerMemoryNotifyingOnSet(() => Deferred.succeed(stateWritten, undefined)),
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
      );

      expect(state?.changes).toMatchInlineSnapshot(`
        {
          "cursor": "2026-01-01T00:01:00Z",
          "lastSuccessAt": "1970-01-01T00:00:00.000Z",
        }
      `);
    }),
  );

  it.effect("does not checkpoint changes when ingestion fails", () =>
    Effect.gen(function* () {
      const errorWritten = yield* Deferred.make<void>();
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        changes: Fetch.changes({
          cursor: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              rows: [{ id: "p1", updatedAt: "2026-01-01T00:01:00Z", value: "one" }],
              cursor: "2026-01-01T00:01:00Z",
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const { running, state } = yield* Effect.gen(function* () {
        const fiber = yield* Effect.forkScoped(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        yield* Deferred.await(errorWritten);
        const running = fiber.pollUnsafe() === undefined;
        const state = yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
        yield* Fiber.interrupt(fiber);
        return { running, state };
      }).pipe(
        Effect.scoped,
        Effect.provide(
          runtimeLayer(
            layerMemoryNotifyingOnError(() => Deferred.succeed(errorWritten, undefined)),
            makeIngestorLayer(ingestedRef, () =>
              Effect.fail(new ConnectorError({ message: "schema mismatch" })),
            ),
          ),
        ),
      );

      expect({
        running,
        backfill: state?.backfill,
        changes: state?.changes,
        lastError: state?.lastError && {
          source: state.lastError.source,
          operation: state.lastError.operation,
          code: state.lastError.code,
          message: state.lastError.message,
        },
      }).toMatchInlineSnapshot(`
        {
          "backfill": undefined,
          "changes": undefined,
          "lastError": {
            "code": "ingest_failed",
            "message": "Changes ingestion failed",
            "operation": "ingest",
            "source": "changes",
          },
          "running": true,
        }
      `);
    }),
  );

  it.effect("keeps a resource in error when its other source completes", () =>
    Effect.gen(function* () {
      const changesFailed = yield* Deferred.make<void>();
      const releaseBackfill = yield* Deferred.make<void>();
      const stateRefreshed = yield* Deferred.make<void>();
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Deferred.await(releaseBackfill).pipe(Effect.as({ rows: [], hasMore: false })),
        }),
        changes: Fetch.changes({
          cursor: Cursor.isoDateTime(),
          fetch: () => Effect.fail(new ConnectorError({ message: "provider unavailable" })),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);
      const stateLayer = Layer.effect(StateStore)(
        StateStore.pipe(
          Effect.provide(StateStoreLayerMemory),
          Effect.map((inner) => ({
            ...inner,
            getResourceState: (resourceName: string) =>
              inner
                .getResourceState(resourceName)
                .pipe(
                  Effect.tap((state) =>
                    state?.backfill?.completed === true
                      ? Deferred.succeed(stateRefreshed, undefined)
                      : Effect.void,
                  ),
                ),
            setResourceError: (...args: Parameters<typeof inner.setResourceError>) =>
              inner
                .setResourceError(...args)
                .pipe(
                  Effect.tap(() =>
                    args[1] === "changes"
                      ? Deferred.succeed(changesFailed, undefined)
                      : Effect.void,
                  ),
                ),
          })),
        ),
      );

      const result = yield* Effect.gen(function* () {
        const fiber = yield* Effect.forkScoped(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        yield* Deferred.await(changesFailed);
        yield* Deferred.succeed(releaseBackfill, undefined);
        yield* Deferred.await(stateRefreshed);
        for (let i = 0; i < 5; i++) {
          yield* Effect.yieldNow;
        }

        const store = yield* StateStore;
        const state = yield* store.getResourceState("products");
        const error = yield* Metric.value(
          Metric.withAttributes(Metrics.syncState, {
            [Attr.connectorName]: "test",
            [Attr.resourceName]: "products",
            [Attr.syncState]: "error",
          }),
        );
        const live = yield* Metric.value(
          Metric.withAttributes(Metrics.syncState, {
            [Attr.connectorName]: "test",
            [Attr.resourceName]: "products",
            [Attr.syncState]: "live",
          }),
        );
        yield* Fiber.interrupt(fiber);
        return { state, error: error.value, live: live.value };
      }).pipe(
        Effect.scoped,
        Effect.provide(
          runtimeLayer(
            stateLayer,
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
      );

      expect(result.state?.lastError).toMatchObject({
        source: "changes",
        operation: "fetch",
      });
      expect(result.state?.backfill?.completed).toBe(true);
      expect({ error: result.error, live: result.live }).toEqual({ error: 1, live: 0 });
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map())),
  );

  it.effect("does not isolate defects", () =>
    Effect.gen(function* () {
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () => Effect.die("unexpected defect"),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const exit = yield* run(connector, {
        initialCutoff: "2026-01-01T00:00:00Z",
      }).pipe(
        Effect.exit,
        Effect.provide(
          runtimeLayer(
            StateStoreLayerMemory,
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
      );

      expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
    }),
  );

  it.effect("preserves source interruption", () =>
    Effect.gen(function* () {
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        changes: Fetch.changes({
          cursor: Cursor.isoDateTime(),
          fetch: () => Effect.never,
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const exit = yield* run(connector, {
        initialCutoff: "2026-01-01T00:00:00Z",
      }).pipe(
        Effect.provide(
          runtimeLayer(
            StateStoreLayerMemory,
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
        Effect.forkScoped,
        Effect.tap((fiber) => Effect.sync(() => fiber.interruptUnsafe())),
        Effect.flatMap(Fiber.await),
        Effect.scoped,
      );

      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
    }),
  );

  it.effect("normalizes Date cursors before checkpointing", () =>
    Effect.gen(function* () {
      const nextCursor = new Date("2026-01-01T00:01:00.000Z");
      const resource = Resource.entity({
        name: "products",
        rowSchema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        check: Effect.void,
        backfill: Fetch.page({
          pageCursor: Cursor.isoDateTime(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              rows: [],
              nextPageCursor: nextCursor,
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const ingestedRef = yield* Ref.make<ReadonlyArray<IngestOptions>>([]);

      const state = yield* Effect.gen(function* () {
        yield* run(connector, { initialCutoff: new Date("2026-01-01T00:00:00.000Z") });
        return yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
      }).pipe(
        Effect.provide(
          runtimeLayer(
            StateStoreLayerMemory,
            makeIngestorLayer(ingestedRef, () => Effect.void),
          ),
        ),
      );

      expect(state?.backfill).toMatchInlineSnapshot(`
        {
          "completed": true,
          "cutoff": "2026-01-01T00:00:00.000Z",
          "lastSuccessAt": "1970-01-01T00:00:00.000Z",
          "pageCursor": "2026-01-01T00:01:00.000Z",
        }
      `);
    }),
  );
});
