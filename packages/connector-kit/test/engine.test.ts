import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Ref, Schema } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";

import { Connector, Cursor, Fetch, Resource } from "../src/core";
import { run } from "../src/ingestion/engine";
import { Publisher, type PublishAck, type PublishOptions } from "../src/publisher/service";
import { layer as StateStoreLayer, StateStore } from "../src/state-store";

type TestRow = { readonly id: string; readonly updatedAt: string; readonly value: string };

const TestRowSchema = Schema.Struct({
  id: Schema.String,
  updatedAt: Schema.String,
  value: Schema.String,
});

Resource.entity({
  name: "typecheck",
  schema: TestRowSchema,
  // @ts-expect-error key must be a field from TestRowSchema
  key: "missing",
  version: "updatedAt",
});

Resource.entity({
  name: "primitive",
  // @ts-expect-error resource schemas must decode object rows with fields
  schema: Schema.String,
  // @ts-expect-error primitive schemas have no resource fields
  key: "id",
  // @ts-expect-error primitive schemas have no resource fields
  version: "id",
});

const accepted = (resource: string): PublishAck => ({ status: "accepted", resource });

// Delegates every operation to the real in-memory KeyValueStore, only intercepting
// `set` to signal `onSet` - used to detect when the engine has checkpointed state.
const layerMemoryNotifyingOnSet = (onSet: () => Effect.Effect<void>) =>
  Layer.effect(KeyValueStore.KeyValueStore)(
    KeyValueStore.KeyValueStore.pipe(
      Effect.provide(KeyValueStore.layerMemory),
      Effect.map((inner) => ({
        ...inner,
        set: (key: string, value: string | Uint8Array) =>
          inner.set(key, value).pipe(Effect.andThen(onSet())),
      })),
    ),
  );

const makePublisherLayer = (
  publishedRef: Ref.Ref<ReadonlyArray<PublishOptions>>,
  publish: (options: PublishOptions) => Effect.Effect<PublishAck>,
) =>
  Layer.succeed(Publisher)({
    publish: (options) =>
      Ref.update(publishedRef, (published) => [...published, options]).pipe(
        Effect.andThen(publish(options)),
      ),
  });

// `run(...)` only requires `KeyValueStore` (it builds its own private `StateStore`
// internally); tests also read state back through their own `StateStore`, so `kvLayer`
// is provided both directly and as the input to that reader - Effect memoizes the two
// uses of the same layer value, so both share one underlying store.
const runtimeLayer = (
  kvLayer: Layer.Layer<KeyValueStore.KeyValueStore>,
  publisherLayer: Layer.Layer<Publisher>,
) => Layer.mergeAll(kvLayer, StateStoreLayer.pipe(Layer.provide(kvLayer)), publisherLayer);

describe("resource ingestion engine", () => {
  it.effect("checkpoints backfill only after accepted publish", () =>
    Effect.gen(function* () {
      const row: TestRow = { id: "p1", updatedAt: "2026-01-01T00:00:00Z", value: "one" };
      const resource = Resource.entity({
        name: "products",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              mutations: [Resource.upsert(row)],
              nextPageCursor: "page-2",
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      const state = yield* Effect.gen(function* () {
        yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" });
        return yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
      }).pipe(
        Effect.provide(
          runtimeLayer(
            KeyValueStore.layerMemory,
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed(accepted(options.resource)),
            ),
          ),
        ),
      );

      const published = yield* Ref.get(publishedRef);

      expect({
        publishedCount: published.length,
        mutationCount: published[0]?.batch.mutations.length,
        backfill: state?.backfill,
      }).toMatchInlineSnapshot(`
        {
          "backfill": {
            "completed": true,
            "cutoff": "2026-01-01T00:00:00Z",
            "pageCursor": "page-2",
          },
          "mutationCount": 1,
          "publishedCount": 1,
        }
      `);
    }),
  );

  it.effect("does not checkpoint when publish is rejected", () =>
    Effect.gen(function* () {
      const resource = Resource.entity({
        name: "products",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              mutations: [
                Resource.upsert({ id: "p1", updatedAt: "2026-01-01T00:00:00Z", value: "one" }),
              ],
              nextPageCursor: "page-2",
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      const { result, state } = yield* Effect.gen(function* () {
        const result = yield* Effect.result(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        const state = yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
        return { result, state };
      }).pipe(
        Effect.provide(
          runtimeLayer(
            KeyValueStore.layerMemory,
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed({
                status: "rejected" as const,
                resource: options.resource,
                reason: "schema mismatch",
              }),
            ),
          ),
        ),
      );

      expect({
        result: result._tag,
        backfill: state?.backfill,
        changes: state?.changes,
        lastErrorIncludesRejected: state?.lastError?.message.includes("rejected"),
      }).toMatchInlineSnapshot(`
        {
          "backfill": undefined,
          "changes": undefined,
          "lastErrorIncludesRejected": true,
          "result": "Failure",
        }
      `);
    }),
  );

  it.effect("advances backfill state for empty accepted pages", () =>
    Effect.gen(function* () {
      const resource = Resource.entity({
        name: "products",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        backfill: Fetch.page({
          pageCursor: Cursor.string(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              mutations: [],
              nextPageCursor: "empty-page",
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      const state = yield* Effect.gen(function* () {
        yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" });
        return yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
      }).pipe(
        Effect.provide(
          runtimeLayer(
            KeyValueStore.layerMemory,
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed(accepted(options.resource)),
            ),
          ),
        ),
      );

      expect(state?.backfill).toMatchInlineSnapshot(`
        {
          "completed": true,
          "cutoff": "2026-01-01T00:00:00Z",
          "pageCursor": "empty-page",
        }
      `);
    }),
  );

  it.effect("checkpoints changes cursor after accepted publish", () =>
    Effect.gen(function* () {
      const stateWritten = yield* Deferred.make<void>();
      const resource = Resource.entity({
        name: "products",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        changes: Fetch.changes({
          cursor: Cursor.isoDateTime(),
          interval: "1 minute",
          fetch: () =>
            Effect.succeed({
              mutations: [
                Resource.upsert({ id: "p1", updatedAt: "2026-01-01T00:01:00Z", value: "one" }),
              ],
              cursor: "2026-01-01T00:01:00Z",
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

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
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed(accepted(options.resource)),
            ),
          ),
        ),
      );

      expect(state?.changes).toMatchInlineSnapshot(`
        {
          "cursor": "2026-01-01T00:01:00Z",
        }
      `);
    }),
  );

  it.effect("does not checkpoint changes when publish is rejected", () =>
    Effect.gen(function* () {
      const resource = Resource.entity({
        name: "products",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        changes: Fetch.changes({
          cursor: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              mutations: [
                Resource.upsert({ id: "p1", updatedAt: "2026-01-01T00:01:00Z", value: "one" }),
              ],
              cursor: "2026-01-01T00:01:00Z",
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      const { result, state } = yield* Effect.gen(function* () {
        const result = yield* Effect.result(
          run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }),
        );
        const state = yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
        return { result, state };
      }).pipe(
        Effect.provide(
          runtimeLayer(
            KeyValueStore.layerMemory,
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed({
                status: "rejected" as const,
                resource: options.resource,
                reason: "schema mismatch",
              }),
            ),
          ),
        ),
      );

      expect({
        result: result._tag,
        backfill: state?.backfill,
        changes: state?.changes,
        lastErrorIncludesRejected: state?.lastError?.message.includes("rejected"),
      }).toMatchInlineSnapshot(`
        {
          "backfill": undefined,
          "changes": undefined,
          "lastErrorIncludesRejected": true,
          "result": "Failure",
        }
      `);
    }),
  );

  it.effect("normalizes Date cursors before checkpointing", () =>
    Effect.gen(function* () {
      const nextCursor = new Date("2026-01-01T00:01:00.000Z");
      const resource = Resource.entity({
        name: "products",
        schema: TestRowSchema,
        key: "id",
        version: "updatedAt",
        backfill: Fetch.page({
          pageCursor: Cursor.isoDateTime(),
          cutoff: Cursor.isoDateTime(),
          fetch: () =>
            Effect.succeed({
              mutations: [],
              nextPageCursor: nextCursor,
              hasMore: false,
            }),
        }),
      });
      const connector = Connector.define({ name: "test", resources: [resource] });
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      const state = yield* Effect.gen(function* () {
        yield* run(connector, { initialCutoff: new Date("2026-01-01T00:00:00.000Z") });
        return yield* StateStore.pipe(
          Effect.flatMap((store) => store.getResourceState("products")),
        );
      }).pipe(
        Effect.provide(
          runtimeLayer(
            KeyValueStore.layerMemory,
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed(accepted(options.resource)),
            ),
          ),
        ),
      );

      expect(state?.backfill).toMatchInlineSnapshot(`
        {
          "completed": true,
          "cutoff": "2026-01-01T00:00:00.000Z",
          "pageCursor": "2026-01-01T00:01:00.000Z",
        }
      `);
    }),
  );
});
