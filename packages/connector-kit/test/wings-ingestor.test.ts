import type { RecordBatch, TypeMap } from "apache-arrow";
import type { TableIdentifier, TableMetadata, TableSchema } from "iceberg-js";

import { describe, expect, it } from "@effect/vitest";
import * as Wings from "@useairfoil/wings";
import { ConfigProvider, Effect, Layer, Ref, Schema } from "effect";

import { Connector, Resource } from "../src/core";
import { ConnectorError } from "../src/errors";
import { Ingestor } from "../src/ingestor/service";
import { layerWings, layerWingsConfig } from "../src/ingestor/wings";
import * as RuntimeConfig from "../src/runtime-config";

const rowSchema = Schema.Struct({ id: Schema.String, count: Schema.Number });
const Products = Resource.entity({ name: "products", rowSchema, check: Effect.void });
const connector = Connector.define({ name: "test", resources: [Products] });
const identifier: TableIdentifier = { namespace: ["default"], name: "products" };

const tableMetadata = (schema?: TableSchema): TableMetadata => ({
  "format-version": 2,
  "table-uuid": "table-uuid",
  schemas: schema ? [{ ...schema, "schema-id": 0 }] : [],
  "current-schema-id": 0,
  "partition-specs": [{ "spec-id": 0, fields: [] }],
  "default-spec-id": 0,
  "sort-orders": [{ "order-id": 0, fields: [] }],
  "default-sort-order-id": 0,
  properties: {},
});

const icebergSchema: TableSchema = {
  type: "struct",
  fields: [
    { id: 1, name: "id", type: "string", required: true },
    { id: 2, name: "count", type: "int", required: false },
  ],
};

const makeManagerLayer = (options: {
  readonly metadata?: TableMetadata;
  readonly loadFailure?: ConnectorError;
  readonly pushFailure?: Wings.IngestorError;
  readonly loaded: Ref.Ref<ReadonlyArray<TableIdentifier>>;
  readonly opened: Ref.Ref<ReadonlyArray<Wings.Ingestor.IngestorOptions>>;
  readonly pushed: Ref.Ref<ReadonlyArray<RecordBatch<TypeMap>>>;
}) =>
  Layer.succeed(Wings.CatalogManager.CatalogManager)({
    createCatalog: () => Effect.die("Unexpected createCatalog"),
    getCatalog: () => Effect.die("Unexpected getCatalog"),
    deleteCatalog: () => Effect.die("Unexpected deleteCatalog"),
    getIcebergCatalog: () =>
      Effect.succeed({
        loadTable: (table: TableIdentifier) =>
          Ref.update(options.loaded, (loaded) => [...loaded, table]).pipe(
            Effect.andThen(
              options.loadFailure
                ? Effect.fail(options.loadFailure)
                : Effect.succeed(options.metadata ?? tableMetadata(icebergSchema)),
            ),
          ),
      } as never),

    ingestor: (ingestorOptions) =>
      Ref.update(options.opened, (opened) => [...opened, ingestorOptions]).pipe(
        Effect.as({
          push: (batch) =>
            Ref.update(options.pushed, (pushed) => [...pushed, batch]).pipe(
              Effect.andThen(options.pushFailure ? Effect.fail(options.pushFailure) : Effect.void),
            ),
        }),
      ),
  });

const makeTest = Effect.gen(function* () {
  const loaded = yield* Ref.make<ReadonlyArray<TableIdentifier>>([]);
  const opened = yield* Ref.make<ReadonlyArray<Wings.Ingestor.IngestorOptions>>([]);
  const pushed = yield* Ref.make<ReadonlyArray<RecordBatch<TypeMap>>>([]);

  return { loaded, opened, pushed };
});

const getIngestor = (
  refs: Effect.Success<typeof makeTest>,
  options?: { readonly metadata?: TableMetadata; readonly pushFailure?: Wings.IngestorError },
) =>
  Ingestor.pipe(
    Effect.provide(
      layerWings({ connector, catalog: "default-catalog", tables: { products: identifier } }),
    ),
    Effect.provide(makeManagerLayer({ ...refs, ...options })),
  );

describe("Wings ingestor adapter", () => {
  it.effect("loads native bindings and pushes catalog-schema Arrow batches", () =>
    Effect.gen(function* () {
      const refs = yield* makeTest;
      const ingestor = yield* getIngestor(refs);

      yield* ingestor.ingest({
        resource: "products",
        source: "changes",
        batch: { rows: [{ count: 2, id: "p1" }] },
      });

      expect(yield* Ref.get(refs.loaded)).toEqual([identifier]);
      expect(yield* Ref.get(refs.opened)).toEqual([
        { catalog: "default-catalog", namespace: ["default"], table: "products" },
      ]);

      const [batch] = yield* Ref.get(refs.pushed);
      expect(batch?.numRows).toBe(1);
      expect(batch?.schema.fields.map((field) => field.name)).toEqual(["id", "count"]);
    }),
  );

  it.effect("does not push empty batches", () =>
    Effect.gen(function* () {
      const refs = yield* makeTest;
      const ingestor = yield* getIngestor(refs);
      yield* ingestor.ingest({ resource: "products", source: "backfill", batch: { rows: [] } });
      expect(yield* Ref.get(refs.pushed)).toEqual([]);
    }),
  );

  it.effect("fails for invalid bindings and missing current schemas", () =>
    Effect.gen(function* () {
      const refs = yield* makeTest;
      const missingBinding = yield* Ingestor.pipe(
        Effect.provide(layerWings({ connector, catalog: "default-catalog", tables: {} as never })),
        Effect.provide(makeManagerLayer(refs)),
        Effect.flip,
      );

      const missingSchema = yield* getIngestor(refs, { metadata: tableMetadata() }).pipe(
        Effect.flip,
      );

      expect(missingBinding.message).toContain("Missing table binding");
      expect(missingSchema.message).toContain("no current schema");
    }),
  );

  it.effect("maps table, metadata, encoding, and Wings push failures to ConnectorError", () =>
    Effect.gen(function* () {
      const loadRefs = yield* makeTest;
      const loadFailure = yield* Ingestor.pipe(
        Effect.provide(
          layerWings({ connector, catalog: "default-catalog", tables: { products: identifier } }),
        ),
        Effect.provide(
          makeManagerLayer({
            ...loadRefs,
            loadFailure: new ConnectorError({ message: "load failed" }),
          }),
        ),
        Effect.flip,
      );

      const metadataRefs = yield* makeTest;
      const metadata = tableMetadata(icebergSchema);

      Reflect.deleteProperty(metadata, "schemas");

      const metadataFailure = yield* getIngestor(metadataRefs, { metadata }).pipe(Effect.flip);

      const encodeRefs = yield* makeTest;
      const encodeIngestor = yield* getIngestor(encodeRefs);
      const encodingFailure = yield* encodeIngestor
        .ingest({
          resource: "products",
          source: "webhook",
          batch: { rows: [{ id: "p1", count: "invalid" }] },
        })
        .pipe(Effect.flip);

      const pushRefs = yield* makeTest;
      const pushIngestor = yield* getIngestor(pushRefs, {
        pushFailure: new Wings.IngestorError({ message: "push failed" }),
      });
      const pushFailure = yield* pushIngestor
        .ingest({
          resource: "products",
          source: "changes",
          batch: { rows: [{ id: "p1", count: 1 }] },
        })
        .pipe(Effect.flip);

      expect(loadFailure).toBeInstanceOf(ConnectorError);
      expect(loadFailure.message).toContain("Failed to load table");
      expect(metadataFailure.message).toContain("Invalid table metadata");
      expect(encodingFailure.message).toBe("Failed to encode rows");
      expect(pushFailure.message).toContain("Failed to ingest rows");
    }),
  );

  it.effect("requires a complete HTTP Wings URL in hosted mode", () =>
    Ingestor.pipe(
      Effect.provide(layerWingsConfig(connector)),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            [RuntimeConfig.PlatformRuntimeKey.wingsUri]: "wings:7777",
            [RuntimeConfig.PlatformRuntimeKey.catalog]: "default-catalog",
          }),
        ),
      ),
      Effect.flip,
      Effect.map((error) => expect(error.message).toBe("Invalid Wings URL")),
    ),
  );
});
