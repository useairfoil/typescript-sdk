# @useairfoil/wings

This package provides an Effect API for Wings catalogs, proxied Iceberg REST catalogs, and Arrow Flight ingestion.

## Installation

```bash
npm install @useairfoil/wings apache-arrow
```

## Catalog manager

The package entrypoint is the `CatalogManager` API. It's used to create, get, and delete catalogs.
From there, you can create an Iceberg client to interact with the catalog (using the `@useairfoil/effect-iceberg` package).

```ts
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { CatalogManager } from "@useairfoil/wings";
import { tableFromArrays } from "apache-arrow";

const CatalogManagerLive = CatalogManager.layer({
  baseUrl: "http://localhost:7777",
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = Effect.gen(function* () {
  // Create a new managed catalog.
  const catalog = yield* CatalogManager.createCatalog({
    id: "analytics",
    rest: {
      uri: "http://localhost:8181",
      warehouse: "s3://analytics",
      properties: { token: "secret" },
    },
  });

  // If the catalog already exists, get it.
  yield* CatalogManager.getCatalog("analytics");

  // Alternatively, get the Iceberg catalog service.
  const iceberg = yield* CatalogManager.getIcebergCatalog("analytics");

  yield* iceberg.listNamespaces();

  yield* Effect.scoped(
    Effect.gen(function* () {
      const ingestor = yield* CatalogManager.ingestor({
        catalog: "analytics",
        namespace: ["events"],
        table: "page_views",
      });
      const batch = tableFromArrays({ event_id: [1] }).batches[0]!;
      yield* ingestor.push(batch);
    }),
  );

  // Remove catalog when done.
  yield* CatalogManager.deleteCatalog("analytics");

  return catalog;
}).pipe(Effect.provide(CatalogManagerLive));
```

The first `push` sends the batch schema. Use the same ingestor for batches with that schema. Each `push` waits for a Wings acknowledgement.
