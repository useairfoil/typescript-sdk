# connector-kit-api

Reference for the current `@useairfoil/connector-kit` authoring surface.

Import from the package root:

```ts
import {
  Connector,
  ConnectorApp,
  ConnectorError,
  Cursor,
  Fetch,
  Ingestion,
  Publisher,
  Resource,
  StateStore,
  Telemetry,
  Webhook,
} from "@useairfoil/connector-kit";

import type {
  ConnectorDefinition,
  Cursor as CursorType,
  ResourceBatch,
  ResourceDefinition,
  ResourceField,
  ResourceMutation,
  ResourcePayload,
  ResourceRow,
  ResourceRows,
  ResourceState,
} from "@useairfoil/connector-kit";
```

All items are re-exported from `packages/connector-kit/src/index.ts`.

## Core Types

### `Cursor.Value`

```ts
type Value = string | number | Date;
```

Date values are allowed at runtime boundaries and normalized to ISO strings before checkpoint writes.

### `ResourceMutation<Row>`

```ts
type DeleteValue = string | number | boolean | Date;

type ResourceMutation<Row extends object = object> =
  | { readonly op: "upsert"; readonly row: Row }
  | { readonly op: "delete"; readonly key: DeleteValue; readonly version: DeleteValue };
```

Use `Resource.upsert(row)` and `Resource.delete({ key, version })` to create mutations.

### `ResourceBatch<Row>`

```ts
type ResourceBatch<Row extends object = object> = {
  readonly cursor?: Cursor.Value;
  readonly mutations: ReadonlyArray<ResourceMutation<Row>>;
};
```

The engine publishes one resource batch at a time and checkpoints after an accepted ACK.

### `ResourceState`

```ts
type ResourceState = {
  readonly backfill?: {
    readonly cutoff: Cursor.Value;
    readonly pageCursor?: Cursor.Value;
    readonly completed: boolean;
  };
  readonly changes?: {
    readonly cursor: Cursor.Value;
  };
};
```

Persisted by `StateStore` per resource name.

### Schema Helpers

```ts
type ResourceRow<S extends ResourceSchema> =
  Schema.Schema.Type<S> extends object ? Schema.Schema.Type<S> : never;

type ResourceField<S extends ResourceSchema> = keyof ResourceRow<S> & string;
```

`ResourceField` preserves exact decoded schema keys for `key` and `version` autocomplete.

## Builders

### `Connector.define(definition)`

```ts
const connector = Connector.define({
  name: "producer-foo",
  title: "Producer Foo",
  resources: [Customers, Orders],
  webhooks: [route],
});
```

Identity function with inference hints; `const` generics preserve literal resource names and tuples.

### `Resource.entity(definition)`

```ts
const Customers = Resource.entity({
  name: "customers",
  schema: CustomerSchema,
  key: "id",
  version: "updatedAt",
  backfill,
  changes,
  webhook,
});
```

The v1 connector-kit model supports entity resources only. `key` and `version` must be fields from the decoded schema row.

### `Resource.webhook(definition)`

```ts
const webhook = Resource.webhook({
  schema: CustomerEventSchema,
  handler: ({ payload }) => Effect.succeed([Resource.upsert(payload.data)]),
});
```

Resource webhook handlers receive typed payloads and return mutations for that resource.

### `Fetch.page(definition)`

```ts
const backfill = Fetch.page({
  pageCursor: Cursor.string(),
  cutoff: Cursor.isoDateTime(),
  fetch: ({ pageCursor, cutoff }) =>
    api.fetchCustomers({ pageCursor, cutoff }).pipe(
      Effect.map((page) => ({
        mutations: page.items.map(Resource.upsert),
        nextPageCursor: page.nextCursor,
        hasMore: page.hasMore,
      })),
    ),
});
```

Backfill fetches page until `hasMore` is false.

### `Fetch.changes(definition)`

```ts
const changes = Fetch.changes({
  cursor: Cursor.isoDateTime(),
  interval: "30 seconds",
  fetch: ({ cursor }) =>
    api.fetchCustomerChanges({ since: cursor }).pipe(
      Effect.map((page) => ({
        mutations: page.items.map(Resource.upsert),
        cursor: page.nextCursor,
      })),
    ),
});
```

Changes fetches poll from the stored cursor.

### `Cursor`

```ts
Cursor.string();
Cursor.number();
Cursor.isoDateTime();
Cursor.nowIsoDateTime;
```

## Webhooks

### `Webhook.route(definition)`

```ts
const route = Webhook.route({
  path: "/webhooks/provider",
  ackMode: "after-publish",
  schema: ProviderWebhookSchema,
  handler: ({ request, rawBody, payload, to }) =>
    Effect.gen(function* () {
      yield* verifySignature({ request, rawBody });
      yield* to(Customers, payload);
      return HttpServerResponse.jsonUnsafe({ ok: true });
    }),
});
```

Route schema validation happens before the handler. Resource-specific schema validation happens inside `to(resource, payload)`.

Handler context:

- `request`: the Effect HTTP server request
- `rawBody`: raw request body bytes for signature verification
- `payload`: route-schema decoded payload
- `to(resource, payload)`: decode through the resource webhook schema and collect mutations

Route behavior:

- invalid body read, invalid JSON, or invalid route payload returns `400`
- unexpected handler/runtime/publisher failures return `500`
- signature verification is connector-owned
- `after-publish` publishes before response completion
- `after-enqueue` enqueues for background publishing

## Ingestion

### `Ingestion.run(connector, options?)`

```ts
Ingestion.run(connector, {
  initialCutoff: yield * Cursor.nowIsoDateTime,
  webhook: {
    routes: connector.webhooks ?? [],
    healthPath: "/health",
    disableHttpLogger: true,
  },
});
```

`Ingestion.run` mounts only the routes passed in `webhook.routes`. Runnable connector CLIs usually use `ConnectorApp.start(...)` instead.

Runtime behavior:

- runs resource backfill, changes, and webhooks concurrently
- publishes through `Publisher.Publisher`
- checkpoints only after accepted ACKs
- fails without checkpointing on rejected ACKs
- lets empty accepted batches advance state

## ConnectorApp

### `ConnectorApp.start(connector, options)`

```ts
ConnectorApp.start(connector, {
  port: 8080,
  initialCutoff,
  healthPath: "/health",
  disableHttpLogger: true,
});
```

Starts the Node HTTP server, mounts connector webhook routes and health, then runs ingestion.

## StateStore

Service methods:

```ts
getResourceState(resource: string): Effect.Effect<ResourceState | undefined, ConnectorError>;
setResourceState(resource: string, state: ResourceState): Effect.Effect<void, ConnectorError>;
```

Use `StateStore.layerMemory` for tests and sandboxes.

## Publisher

Service method:

```ts
publish(options: {
  readonly resource: string;
  readonly source: "backfill" | "changes" | "webhook";
  readonly batch: ResourceBatch<Row>;
}): Effect.Effect<PublishAck, ConnectorError>;
```

ACK shape:

```ts
type PublishAck =
  | {
      readonly status: "accepted";
      readonly resource: string;
      readonly partition?: Wings.PartitionValue.PartitionValue;
    }
  | {
      readonly status: "rejected";
      readonly resource: string;
      readonly reason: string;
      readonly rejectedRows?: number;
      readonly partition?: Wings.PartitionValue.PartitionValue;
    };
```

### `Publisher.layerWings(config)`

```ts
Publisher.layerWings({
  connector,
  tables: {
    customers: "namespaces/default/tables/customers",
    orders: {
      name: "namespaces/default/tables/orders",
      partitionValue: "account_123",
    },
  },
});
```

The Wings publisher resolves table metadata, validates key/version/partition compatibility, splits mixed upsert/delete batches, sends upserts as full rows, and sends deletes as key/version-only rows.

## Telemetry

Common layers:

- `Telemetry.layer(config, options?)`
- `Telemetry.layerConfig(config, options?)`
- `Telemetry.layerOtlpTracing(options?)`

Use provider-specific `redactedHeaders` for custom secret headers.
