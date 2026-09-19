# Effect Iceberg

This package gives an Effect API for the `iceberg-js` REST catalog client.

## Install

```bash
pnpm add @useairfoil/effect-iceberg effect@rc iceberg-js
```

## Usage

```ts
import { IcebergCatalog } from "@useairfoil/effect-iceberg";
import { Effect } from "effect";

const namespaces = IcebergCatalog.listNamespaces().pipe(
  Effect.provide(
    IcebergCatalog.layer({
      baseUrl: "https://catalog.example.com",
      warehouse: "warehouse",
    }),
  ),
);
```
