# @useairfoil/effect-iceberg

Effect wrapper for [`iceberg-js`](https://github.com/supabase/iceberg-js).

This package provides Effect services and layers around `iceberg-js`. It does not replace the
`iceberg-js` API or type surface. Import Apache Iceberg domain types directly from `iceberg-js`.

## Install

```sh
pnpm add @useairfoil/effect-iceberg iceberg-js effect
```

`iceberg-js` and `effect` are peer dependencies so your application owns their versions.

## Usage

```typescript
import { Effect } from "effect";
import { IcebergCatalog, layer } from "@useairfoil/effect-iceberg";
import type { TableIdentifier } from "iceberg-js";

const IcebergLive = layer({
  baseUrl: "https://catalog.example.com",
  warehouse: "warehouse",
  auth: { type: "bearer", token: process.env.ICEBERG_TOKEN ?? "" },
});

const program = Effect.gen(function* () {
  const catalog = yield* IcebergCatalog.IcebergCatalog;

  const id: TableIdentifier = { namespace: ["analytics"], name: "events" };
  return yield* catalog.loadTable(id);
});

await Effect.runPromise(program.pipe(Effect.provide(IcebergLive)));
```

## Errors

`iceberg-js` failures are mapped to `IcebergCatalogError`.

```typescript
import { Effect } from "effect";
import { IcebergCatalogError } from "@useairfoil/effect-iceberg";

const handled = program.pipe(
  Effect.catchTag("IcebergCatalogError", (error: IcebergCatalogError) =>
    Effect.succeed({ status: error.status, type: error.icebergType }),
  ),
);
```
