import { describe, expect, it } from "@effect/vitest";
import * as Wings from "@useairfoil/wings";
import { Effect, Layer, Ref, Schema } from "effect";

import { Connector, Resource } from "../src/core";
import { Publisher } from "../src/publisher/service";
import { layerWings } from "../src/publisher/wings";

type PushOptions = Wings.WingsClient.PushOptions;

const ProductSchema = Schema.Struct({
  id: Schema.String,
  updatedAt: Schema.String,
  value: Schema.String,
});

const Products = Resource.entity({
  name: "products",
  schema: ProductSchema,
  key: "id",
  version: "updatedAt",
});

const connector = Connector.define({ name: "test", resources: [Products] });

// Minimal Wings table metadata used by layerWings without starting a Wings server.
const field = (name: string, id: bigint): Wings.Cluster.ArrowType.Field =>
  ({ name, id, nullable: false, metadata: {} }) as Wings.Cluster.ArrowType.Field;

const table = (options?: {
  readonly keyName?: string;
  readonly versionName?: string;
  readonly partition?: boolean;
}): Wings.Cluster.Table.Table => {
  const fields = [
    field(options?.keyName ?? "id", 1n),
    field(options?.versionName ?? "updatedAt", 2n),
    field("value", 3n),
  ];
  return {
    name: "namespaces/default/tables/products",
    schema: {
      fields: options?.partition ? [...fields, field("tenant", 4n)] : fields,
      metadata: {},
    },
    keyFieldId: 1n,
    versionFieldId: 2n,
    partitionFieldId: options?.partition ? 4n : undefined,
    targetFreshnessSeconds: 60n,
  } as Wings.Cluster.Table.Table;
};

const makeWingsLayer = (
  tableValue: Wings.Cluster.Table.Table,
  pushCallsRef: Ref.Ref<ReadonlyArray<PushOptions>>,
) =>
  // layerWings only needs getTable and publisher.push for these adapter tests.
  Layer.succeed(Wings.WingsClient.WingsClient)({
    flightClient: {} as never,
    clusterClient: {
      getTable: () => Effect.succeed(tableValue),
    } as never,
    fetch: () => Effect.die("Unexpected fetch"),
    publisher: () =>
      Effect.succeed({
        push: (options: PushOptions) =>
          Ref.update(pushCallsRef, (calls) => [...calls, options]).pipe(
            Effect.as({ accepted: true, message: "" }),
          ),
      }),
  });

const makePublisher = (
  tableValue: Wings.Cluster.Table.Table,
  pushCallsRef: Ref.Ref<ReadonlyArray<PushOptions>>,
) =>
  Effect.gen(function* () {
    return yield* Publisher;
  }).pipe(
    Effect.provide(layerWings({ connector, tables: { products: tableValue.name } })),
    Effect.provide(makeWingsLayer(tableValue, pushCallsRef)),
  );

describe("Wings publisher adapter", () => {
  it.effect("fails when a table mapping is missing", () =>
    Effect.gen(function* () {
      const pushCallsRef = yield* Ref.make<ReadonlyArray<PushOptions>>([]);
      const result = yield* Effect.result(
        Effect.gen(function* () {
          return yield* Publisher;
        }).pipe(
          Effect.provide(layerWings({ connector, tables: {} })),
          Effect.provide(makeWingsLayer(table(), pushCallsRef)),
        ),
      );

      expect(result._tag).toBe("Failure");
    }),
  );

  it.effect("fails when resource key does not match the Wings table key", () =>
    Effect.gen(function* () {
      const pushCallsRef = yield* Ref.make<ReadonlyArray<PushOptions>>([]);
      const result = yield* Effect.result(
        makePublisher(table({ keyName: "other_id" }), pushCallsRef),
      );

      expect(result._tag).toBe("Failure");
    }),
  );

  it.effect("publishes mixed upserts and deletes as separate Wings pushes", () =>
    Effect.gen(function* () {
      const pushCallsRef = yield* Ref.make<ReadonlyArray<PushOptions>>([]);
      const publisher = yield* makePublisher(table(), pushCallsRef);

      const ack = yield* publisher.publish({
        resource: "products",
        source: "changes",
        batch: {
          mutations: [
            Resource.upsert({
              id: "p1",
              updatedAt: "2026-01-01T00:00:00.000Z",
              value: "one",
            }),
            Resource.delete({
              key: "p2",
              version: "2026-01-02T00:00:00.000Z",
            }),
          ],
        },
      });

      const calls = yield* Ref.get(pushCallsRef);
      expect(ack.status).toBe("accepted");
      // Wings expects different ingestion schemas for upsert rows and delete key/version rows.
      expect(calls.map((call) => call.operation)).toEqual(["upsert", "delete"]);
      expect(
        calls[0]?.batch.schema.fields.map((field: { readonly name: string }) => field.name),
      ).toEqual(["id", "updatedAt", "value"]);
      expect(
        calls[1]?.batch.schema.fields.map((field: { readonly name: string }) => field.name),
      ).toEqual(["id", "updatedAt"]);
    }),
  );

  it.effect("accepts empty batches without pushing to Wings", () =>
    Effect.gen(function* () {
      const pushCallsRef = yield* Ref.make<ReadonlyArray<PushOptions>>([]);
      const publisher = yield* makePublisher(table(), pushCallsRef);

      const ack = yield* publisher.publish({
        resource: "products",
        source: "backfill",
        batch: { mutations: [] },
      });

      expect(ack.status).toBe("accepted");
      expect(yield* Ref.get(pushCallsRef)).toHaveLength(0);
    }),
  );
});
