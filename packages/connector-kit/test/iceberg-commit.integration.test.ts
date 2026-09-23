import { describe, expect, it } from "@effect/vitest";
import { CatalogManager } from "@useairfoil/wings";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { getCurrentSchema } from "iceberg-js";

import { Iceberg } from "../src";

describe("Iceberg table creation commits", () => {
  it.effect(
    "preserves explicit field IDs through Wings and SeaweedFS",
    () =>
      Effect.gen(function* () {
        const wings = yield* TestWings.Instance;
        const uri = yield* wings.uri;
        const icebergRestUri = yield* wings.icebergRestUri;
        const manager = yield* CatalogManager.make({ baseUrl: uri });
        const catalogId = "explicit-field-ids";
        const namespace = ["schema_ids"];
        const identifier = { namespace, name: "events" };

        yield* manager.createCatalog({
          id: catalogId,
          rest: {
            uri: icebergRestUri,
            warehouse: "s3://default-catalog",
          },
        });

        const catalog = yield* manager.getIcebergCatalog(catalogId);
        yield* catalog.createNamespaceIfNotExists({ namespace });

        const Row = Schema.Struct({
          id: Schema.String.pipe(Iceberg.field(1)),
          nested: Schema.Struct({
            value: Schema.String.pipe(Iceberg.field(101)),
          }).pipe(Iceberg.field(2)),
          items: Schema.Array(Schema.String.annotate({ fieldId: 201 })).pipe(Iceberg.field(3)),
          labels: Schema.ReadonlyMap(
            Schema.String.annotate({ fieldId: 301 }),
            Schema.String.annotate({ fieldId: 302 }),
          ).pipe(Iceberg.field(4)),
        });
        const request = yield* Iceberg.makeCreateTableCommitRequest(Row, {
          location: "s3://default-catalog/schema_ids/events",
          uuid: "00000000-0000-4000-8000-000000000001",
        });

        yield* catalog.commitTable(identifier, request);

        const metadata = yield* catalog.loadTable(identifier);
        const schema = getCurrentSchema(metadata);

        expect(schema).toMatchObject({
          fields: [
            { id: 1, name: "id" },
            {
              id: 2,
              name: "nested",
              type: { type: "struct", fields: [{ id: 101, name: "value" }] },
            },
            {
              id: 3,
              name: "items",
              type: { type: "list", "element-id": 201 },
            },
            {
              id: 4,
              name: "labels",
              type: { type: "map", "key-id": 301, "value-id": 302 },
            },
          ],
        });
      }).pipe(
        Effect.provide(FetchHttpClient.layer),
        Effect.provide(TestWings.container),
        Effect.scoped,
      ),
    { timeout: 120_000 },
  );
});
