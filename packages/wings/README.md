# @useairfoil/wings

This package provides an Effect API to interact with the Wings catalog API and its proxied Iceberg REST catalogs.

## Installation

```bash
npm install @useairfoil/wings
```

## Catalog manager

The package entrypoint is the `CatalogManager` API. It's used to create, get, and delete catalogs.
From there, you can create an Iceberg client to interact with the catalog (using the `@useairfoil/effect-iceberg` package).

```ts
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { CatalogManager } from "@useairfoil/wings";

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

  // Remove catalog when done.
  yield* CatalogManager.deleteCatalog("analytics");

  return catalog;
}).pipe(Effect.provide(CatalogManagerLive));
```
