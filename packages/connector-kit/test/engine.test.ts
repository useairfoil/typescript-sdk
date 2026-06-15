import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Ref, Schema } from "effect";

import type { ResourceState } from "../src/core/types";

import { Connector, Cursor, Fetch, Resource } from "../src/core";
import { run } from "../src/ingestion/engine";
import { Publisher, type PublishAck, type PublishOptions } from "../src/publisher/service";
import { StateStore } from "../src/state-store";

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

const makeStateLayer = (stateRef: Ref.Ref<Map<string, ResourceState>>) =>
  Layer.succeed(StateStore)({
    getResourceState: (resource) => Effect.map(Ref.get(stateRef), (state) => state.get(resource)),
    setResourceState: (resource, state) =>
      Ref.update(stateRef, (current) => {
        const next = new Map(current);
        next.set(resource, state);
        return next;
      }),
  });

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
      const stateRef = yield* Ref.make(new Map<string, ResourceState>());
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeStateLayer(stateRef),
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed(accepted(options.resource)),
            ),
          ),
        ),
      );

      const state = (yield* Ref.get(stateRef)).get("products");
      const published = yield* Ref.get(publishedRef);

      expect(published).toHaveLength(1);
      expect(published[0]?.batch.mutations).toHaveLength(1);
      expect(state?.backfill).toEqual({
        cutoff: "2026-01-01T00:00:00Z",
        pageCursor: "page-2",
        completed: true,
      });
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
      const stateRef = yield* Ref.make(new Map<string, ResourceState>());
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      const result = yield* Effect.result(
        run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }).pipe(
          Effect.provide(
            Layer.mergeAll(
              makeStateLayer(stateRef),
              makePublisherLayer(publishedRef, (options) =>
                Effect.succeed({
                  status: "rejected" as const,
                  resource: options.resource,
                  reason: "schema mismatch",
                }),
              ),
            ),
          ),
        ),
      );

      expect(result._tag).toBe("Failure");
      expect((yield* Ref.get(stateRef)).get("products")).toBeUndefined();
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
      const stateRef = yield* Ref.make(new Map<string, ResourceState>());
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      yield* run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeStateLayer(stateRef),
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed(accepted(options.resource)),
            ),
          ),
        ),
      );

      expect((yield* Ref.get(stateRef)).get("products")?.backfill).toEqual({
        cutoff: "2026-01-01T00:00:00Z",
        pageCursor: "empty-page",
        completed: true,
      });
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
      const stateRef = yield* Ref.make(new Map<string, ResourceState>());
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);
      const stateLayer = Layer.succeed(StateStore)({
        getResourceState: (resource) =>
          Effect.map(Ref.get(stateRef), (state) => state.get(resource)),
        setResourceState: (resource, state) =>
          Ref.update(stateRef, (current) => {
            const next = new Map(current);
            next.set(resource, state);
            return next;
          }).pipe(Effect.tap(() => Deferred.succeed(stateWritten, undefined))),
      });

      const fiber = yield* Effect.forkScoped(
        run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }).pipe(
          Effect.provide(
            Layer.mergeAll(
              stateLayer,
              makePublisherLayer(publishedRef, (options) =>
                Effect.succeed(accepted(options.resource)),
              ),
            ),
          ),
        ),
      );

      yield* Deferred.await(stateWritten);
      yield* Fiber.interrupt(fiber);

      expect((yield* Ref.get(stateRef)).get("products")?.changes).toEqual({
        cursor: "2026-01-01T00:01:00Z",
      });
    }).pipe(Effect.scoped),
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
      const stateRef = yield* Ref.make(new Map<string, ResourceState>());
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      const result = yield* Effect.result(
        run(connector, { initialCutoff: "2026-01-01T00:00:00Z" }).pipe(
          Effect.provide(
            Layer.mergeAll(
              makeStateLayer(stateRef),
              makePublisherLayer(publishedRef, (options) =>
                Effect.succeed({
                  status: "rejected" as const,
                  resource: options.resource,
                  reason: "schema mismatch",
                }),
              ),
            ),
          ),
        ),
      );

      expect(result._tag).toBe("Failure");
      expect((yield* Ref.get(stateRef)).get("products")).toBeUndefined();
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
      const stateRef = yield* Ref.make(new Map<string, ResourceState>());
      const publishedRef = yield* Ref.make<ReadonlyArray<PublishOptions>>([]);

      yield* run(connector, { initialCutoff: new Date("2026-01-01T00:00:00.000Z") }).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeStateLayer(stateRef),
            makePublisherLayer(publishedRef, (options) =>
              Effect.succeed(accepted(options.resource)),
            ),
          ),
        ),
      );

      expect((yield* Ref.get(stateRef)).get("products")?.backfill).toEqual({
        cutoff: "2026-01-01T00:00:00.000Z",
        pageCursor: "2026-01-01T00:01:00.000Z",
        completed: true,
      });
    }),
  );
});
