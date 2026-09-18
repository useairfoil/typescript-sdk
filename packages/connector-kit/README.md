# Connector Kit

Use this package to build an Airfoil producer connector.

## Install

```bash
pnpm add @useairfoil/connector-kit effect@rc
```

## Usage

- `Connector`, `Resource`, `Fetch`, and `Cursor` define the data flow.
- `Manifest` defines user config.
- `ConnectorApp` checks config and runs the HTTP server.
- `Ingestor` writes batches to the console or Wings.
- `StateStore` keeps ingestion progress.
- `Webhook` defines webhook routes.

Here is a small resource:

```ts
import { Connector, Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";

const PostSchema = Schema.Struct({
  id: Schema.Number,
  updatedAt: Schema.String,
});

const Posts = Resource.entity({
  name: "posts",
  rowSchema: PostSchema,
  key: "id",
  version: "updatedAt",

  check: Effect.void,
  backfill: Fetch.page({
    pageCursor: Cursor.number(),
    cutoff: Cursor.isoDateTime(),
    fetch: () =>
      Effect.succeed({
        rows: [],
        nextPageCursor: 1,
        hasMore: false,
      }),
  }),
});

const connector = Connector.define({
  name: "producer-example",
  resources: [Posts],
});
```

Changes and webhooks may return partial rows, but the key and version are
required. Missing, `undefined`, and `null` values do not update stored columns.
For tables that support deletion, send `_af_deleted: true` and omit it otherwise.

For local runs, use `StateStore.layerMemory` and `Ingestor.layerConsole`. For a
hosted run, use `RuntimeConfig.layerHosted()`, PostgreSQL state, and
`Ingestor.layerWingsConfig(connector)`.

## Configuration

| Variable                        | Required | Default                     |
| ------------------------------- | -------- | --------------------------- |
| `AIRFOIL_CONFIG_PATH`           | yes      | none                        |
| `WINGS_URI`                     | yes      | none                        |
| `AIRFOIL_CATALOG`               | yes      | none                        |
| `AIRFOIL_TABLE_BINDINGS`        | yes      | none                        |
| `AIRFOIL_CONNECTOR_INSTANCE_ID` | yes      | none                        |
| `POSTGRES_CONNECTION_STRING`    | yes      | none                        |
| `AIRFOIL_HTTP_PORT`             | no       | `8080`                      |
| `AIRFOIL_STATE_TABLE`           | no       | `_airfoil_connectors_state` |

```env
AIRFOIL_TABLE_BINDINGS={"posts":{"namespace":["default"],"name":"posts"}}
```

The HTTP server has `/health`, `/status`, and `/metrics` endpoints.
