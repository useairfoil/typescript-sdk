# @useairfoil/effect-iceberg

Effect wrapper for [`iceberg-js`](https://github.com/supabase/iceberg-js), the Apache Iceberg REST Catalog client.

This package provides an Effect service, layers, accessors, and typed errors around `iceberg-js`. It does not replace the `iceberg-js` API or type surface. Import Apache Iceberg domain types directly from `iceberg-js`.

## Install

```sh
pnpm add @useairfoil/effect-iceberg iceberg-js effect
```

`iceberg-js` and `effect` are peer dependencies so your application owns their versions.

## Imports

```typescript
import { IcebergCatalog, IcebergError } from "@useairfoil/effect-iceberg";
import type { CreateTableRequest, TableIdentifier } from "iceberg-js";
```

`@useairfoil/effect-iceberg` exports wrapper modules only:

- `IcebergCatalog` contains the service tag, constructors, layers, and accessor functions.
- `IcebergError` contains the Effect error type and mapper for failures from `iceberg-js`.

Use `iceberg-js` directly for catalog options, request/response types, metadata types, table update unions, and helpers.

## Layer

Create a layer from normal `iceberg-js` catalog options:

```typescript
import { IcebergCatalog } from "@useairfoil/effect-iceberg";

const IcebergLive = IcebergCatalog.layer({
  baseUrl: "https://catalog.example.com",
  warehouse: "warehouse",
  auth: { type: "bearer", token: process.env.ICEBERG_TOKEN ?? "" },
  accessDelegation: ["vended-credentials"],
});
```

Or build a layer from Effect `Config` values:

```typescript
import { Config } from "effect";
import { IcebergCatalog } from "@useairfoil/effect-iceberg";
import type { AuthConfig } from "iceberg-js";

const IcebergLive = IcebergCatalog.layerConfig({
  baseUrl: Config.string("ICEBERG_REST_URL"),
  warehouse: Config.string("ICEBERG_WAREHOUSE"),
  auth: Config.string("ICEBERG_TOKEN").pipe(
    Config.map((token): AuthConfig => ({ type: "bearer", token })),
  ),
});
```

## Usage

Use the accessor functions for most application code. They read the `IcebergCatalog` service from the Effect context and delegate to the underlying `iceberg-js` client.

```typescript
import { Effect } from "effect";
import { IcebergCatalog } from "@useairfoil/effect-iceberg";
import type { TableIdentifier } from "iceberg-js";

const IcebergLive = IcebergCatalog.layer({
  baseUrl: "https://catalog.example.com",
  warehouse: "warehouse",
  auth: { type: "bearer", token: process.env.ICEBERG_TOKEN ?? "" },
});

const program = Effect.gen(function* () {
  const id: TableIdentifier = { namespace: ["analytics"], name: "events" };
  return yield* IcebergCatalog.loadTable(id);
});

await Effect.runPromise(program.pipe(Effect.provide(IcebergLive)));
```

## Catalog Operations

The `IcebergCatalog` module mirrors the public `iceberg-js` `IcebergRestCatalog` methods as Effect accessors:

```typescript
const program = Effect.gen(function* () {
  const namespaces = yield* IcebergCatalog.listNamespaces();

  const tables = yield* IcebergCatalog.listTables({ namespace: ["analytics"] });

  const table = yield* IcebergCatalog.loadTable({
    namespace: ["analytics"],
    name: "events",
  });

  return { namespaces, tables, table };
});
```

Create tables with request types from `iceberg-js`:

```typescript
import type { CreateTableRequest } from "iceberg-js";

const request: CreateTableRequest = {
  name: "events",
  schema: {
    type: "struct",
    "schema-id": 0,
    fields: [{ id: 1, name: "id", type: "string", required: true }],
  },
};

const program = Effect.gen(function* () {
  return yield* IcebergCatalog.createTable({ namespace: ["analytics"] }, request);
});
```

Use `loadTableResult`, `createTableResult`, or `registerTableResult` when you need the full spec-aligned result, including server config, storage credentials, metadata location, and ETag:

```typescript
const program = Effect.gen(function* () {
  const result = yield* IcebergCatalog.loadTableResult({
    namespace: ["analytics"],
    name: "events",
  });

  if (result) {
    console.log(result.etag);
    console.log(result["storage-credentials"]);
  }

  return result;
});
```

Conditional table loads return `null` when the server responds with `304 Not Modified`:

```typescript
const program = Effect.gen(function* () {
  return yield* IcebergCatalog.loadTable(
    { namespace: ["analytics"], name: "events" },
    { ifNoneMatch: "abc123" },
  );
});
```

## Service Access

For advanced use cases, access the service directly. This is useful when you want the underlying `iceberg-js` client or want to call several methods from one service value.

```typescript
const program = Effect.gen(function* () {
  const catalog = yield* IcebergCatalog.IcebergCatalog;
  const client = catalog.getCatalogClient();

  yield* catalog.loadConfig();
  return client;
});
```

## Errors

Failures thrown by `iceberg-js` are mapped to `IcebergError.IcebergError`. The wrapper preserves the important Iceberg fields: HTTP `status`, Iceberg exception `type` / `code`, `details`, and `isCommitStateUnknown`.

```typescript
import { Effect } from "effect";
import { IcebergError } from "@useairfoil/effect-iceberg";

const handled = program.pipe(
  Effect.catchTag("IcebergError", (error: IcebergError.IcebergError) =>
    Effect.succeed({ status: error.status, type: error.icebergType }),
  ),
);
```

You can also inspect commit-state ambiguity from the Iceberg REST spec:

```typescript
const safeCommit = IcebergCatalog.commitTable(id, request).pipe(
  Effect.catchTag("IcebergError", (error) => {
    if (error.isCommitStateUnknown) {
      return Effect.fail(error);
    }
    return Effect.fail(error);
  }),
);
```

## Direct `iceberg-js` Types

Keep domain types close to `iceberg-js`:

```typescript
import type {
  CommitTableRequest,
  LoadTableResultWithEtag,
  NamespaceIdentifier,
  TableIdentifier,
  TableMetadata,
  TableUpdate,
} from "iceberg-js";
```

This keeps your application aligned with the exact `iceberg-js` version you install, while `@useairfoil/effect-iceberg` provides the Effect integration layer.
