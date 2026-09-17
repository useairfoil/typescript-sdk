# Wings

This package has the Effect clients for Wings catalogs and Arrow Flight
ingestion.

## Install

```bash
pnpm add @useairfoil/wings effect@rc
```

## Usage

```ts
import { CatalogManager } from "@useairfoil/wings";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const catalog = CatalogManager.getCatalog("analytics").pipe(
  Effect.provide(
    CatalogManager.layer({ baseUrl: "http://localhost:7777" }).pipe(
      Layer.provide(FetchHttpClient.layer),
    ),
  ),
);
```

Use `CatalogManager.ingestor(...)` inside `Effect.scoped`. The first batch
sets the Arrow schema. Later batches on that stream must use the same schema.
