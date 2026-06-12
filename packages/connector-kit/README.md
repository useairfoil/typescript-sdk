# @useairfoil/connector-kit

Toolkit for building Airfoil producer connectors with Effect.

`@useairfoil/connector-kit` gives connector authors the pieces needed to define, run, test, and publish resource-first producer connectors:

- `Connector.define(...)` describes a connector.
- `Resource.entity(...)` describes a Wings table-backed resource.
- `Fetch.page(...)` and `Fetch.changes(...)` describe backfill and polling fetches.
- `Resource.webhook(...)` lets a resource normalize provider webhook payloads into mutations.
- `Webhook.route(...)` defines connector-level HTTP webhook routes.
- `Ingestion.run(...)` runs resource ingestion and checkpoints after accepted publishes.
- `Publisher.layerConsole` logs accepted batches locally.
- `Publisher.layerWings(...)` publishes resource mutations into Wings tables.
- `ConnectorApp.start(...)` starts a complete Node HTTP connector process.

The package is intentionally Layer-oriented: connector code defines resources and routes, while entrypoints provide runtime dependencies such as publishers, state stores, telemetry, and API clients.

## Install

```bash
pnpm add @useairfoil/connector-kit effect@beta
```

This repo currently uses Effect v4 beta. In workspace packages, prefer the workspace catalog (`"effect": "catalog:"`) so all packages stay on the pinned beta version.

## Package Shape

The package root exposes the common connector authoring API:

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
```

Subpath exports are available for runtime domains:

- `@useairfoil/connector-kit/ingestion`
- `@useairfoil/connector-kit/connector-app`
- `@useairfoil/connector-kit/publisher`
- `@useairfoil/connector-kit/state-store`
- `@useairfoil/connector-kit/webhook`
- `@useairfoil/connector-kit/errors`

Core definition helpers and `Telemetry` are intentionally root-only.

## Resource Model

Resources emit mutations, not raw rows. Connector Kit currently supports `Resource.entity(...)` for Wings table-backed resources.

```ts
const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
  backfill: Fetch.page({
    pageCursor: Cursor.number(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor }) =>
      api.fetchPosts({ page: typeof pageCursor === "number" ? pageCursor : 1 }).pipe(
        Effect.map((page) => ({
          mutations: page.items.map(Resource.upsert),
          nextPageCursor: page.hasMore ? page.nextPage : page.page,
          hasMore: page.hasMore,
        })),
      ),
  }),
});
```

`key` and `version` autocomplete from the decoded schema row type. Invalid field names are rejected at compile time.

Mutations are created with:

```ts
Resource.upsert(row);

Resource.delete({
  key: "post_123",
  version: "2026-01-01T00:00:00.000Z",
});
```

## Fetches

`Fetch.page(...)` is for paginated backfill. It receives the stored page cursor and the resource cutoff.

`Fetch.changes(...)` is for polling incremental changes. It receives the stored changes cursor and can be configured with an interval.

Cursor helpers:

- `Cursor.string()`
- `Cursor.number()`
- `Cursor.isoDateTime()`
- `Cursor.nowIsoDateTime`

Date cursor values are accepted at API boundaries and normalized to ISO strings before checkpoint writes.

## Webhooks

Webhooks are connector-level routes with schema-validated payloads. A route dispatches to resource-owned webhook handlers by calling `to(resource, payload)`.

```ts
const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
  webhook: Resource.webhook({
    schema: PostEventSchema,
    handler: ({ payload }) => Effect.succeed([Resource.upsert(payload.data)]),
  }),
});

const route = Webhook.route({
  path: "/webhooks/example",
  ackMode: "after-publish",
  schema: ProviderWebhookSchema,
  handler: ({ request, rawBody, payload, to }) =>
    Effect.gen(function* () {
      yield* verifySignature({ request, rawBody });
      yield* to(Posts, payload);
      return HttpServerResponse.jsonUnsafe({ ok: true });
    }),
});
```

Route behavior:

- reads the raw body once
- parses JSON once
- validates the route payload schema
- passes `request`, `rawBody`, typed `payload`, and `to(...)` to the handler
- returns `400` for invalid body reads, invalid JSON, or invalid route payloads
- returns `500` for unexpected handler/runtime/publisher failures

Signature verification is connector-owned and should use `rawBody`.

`ackMode: "after-publish"` publishes collected mutations before the response is completed. `ackMode: "after-enqueue"` enqueues collected mutations and lets the background webhook consumer publish them.

## Connector Definition

```ts
const connector = Connector.define({
  name: "producer-example",
  title: "Producer Example",
  resources: [Posts],
  webhooks: [route],
});
```

## Ingestion

`Ingestion.run(...)` contains the runtime engine. `ConnectorApp.start(...)` is the usual entrypoint for runnable producer CLIs.

Current runtime behavior:

- runs resource backfill, changes, and webhooks concurrently
- initializes the same initial cutoff for backfill and changes
- publishes through `Publisher.Publisher`
- checkpoints only after an accepted publish ACK
- does not checkpoint rejected publishes
- allows empty accepted batches to advance state
- persists resource state through `StateStore.StateStore`

Use `StateStore.layerMemory` for development and tests, or provide your own durable `StateStore` implementation.

## Publisher

`Publisher.Publisher` is the Effect service boundary for publishing resource mutation batches.

`Publisher.layerConsole` accepts batches and logs them locally.

`Publisher.layerWings(...)` publishes mutations to Wings tables:

```ts
const publisherLayer = Publisher.layerWings({
  connector,
  tables: {
    posts: "namespaces/default/tables/posts",
  },
});
```

The `tables` map is keyed by resource name. Values can be table names or objects with a table name and optional partition value.

```ts
Publisher.layerWings({
  connector,
  tables: {
    posts: {
      name: "namespaces/default/tables/posts",
      partitionValue: "account_123",
    },
  },
});
```

The Wings publisher resolves table metadata during layer construction, validates resource key/version/partition compatibility, sends upserts with full rows, and sends deletes with key/version-only rows.

## Minimal Example

```ts
import { NodeRuntime } from "@effect/platform-node";
import {
  Connector,
  ConnectorApp,
  Cursor,
  Fetch,
  Publisher,
  Resource,
  StateStore,
  Telemetry,
} from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const PostSchema = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  updatedAt: Schema.String,
});

type Post = Schema.Schema.Type<typeof PostSchema>;

const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
  backfill: Fetch.page({
    pageCursor: Cursor.number(),
    cutoff: Cursor.isoDateTime(),
    fetch: () =>
      Effect.succeed({
        mutations: [
          Resource.upsert({ id: 1, title: "Hello", updatedAt: "2026-01-01T00:00:00.000Z" }),
        ],
        nextPageCursor: 1,
        hasMore: false,
      }),
  }),
});

const connector = Connector.define({
  name: "producer-example",
  resources: [Posts],
});

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const TelemetryLayer = Telemetry.layerOtlpTracing().pipe(Layer.provide(EnvLayer));
const runtimeLayer = Layer.mergeAll(StateStore.layerMemory, Publisher.layerConsole, TelemetryLayer);

Effect.scoped(ConnectorApp.start(connector, { port: 8080 })).pipe(
  Effect.provide(runtimeLayer),
  NodeRuntime.runMain,
);
```

## Telemetry

`Telemetry` contains connector-kit span names, span attributes, error annotation helpers, and OTLP tracing layers.

Common entry points:

- `Telemetry.layer(config, options?)`
- `Telemetry.layerConfig(config, options?)`
- `Telemetry.layerOtlpTracing(options?)`

Default redacted headers:

- `authorization`
- `cookie`
- `set-cookie`
- `x-api-key`
- `/api[-_]?key/i`
- `/secret/i`
- `/signature/i`
- `/token/i`

Telemetry environment variables:

| Variable                      | Read by       | Description                                                                                                                |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `OTEL_ENABLED`                | Connector Kit | Enables trace export when `true`. Defaults to `false`.                                                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Connector Kit | OTLP base URL, for example `http://localhost:4318`. Connector Kit appends `/v1/traces`. Required when `OTEL_ENABLED=true`. |
| `OTEL_EXPORTER_OTLP_HEADERS`  | Connector Kit | Optional comma-separated headers, for example `Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>`.                    |
| `OTEL_SERVICE_NAME`           | Effect        | Service name resource attribute, for example `producer-shopify`.                                                           |
| `OTEL_SERVICE_VERSION`        | Effect        | Optional service version resource attribute.                                                                               |
| `OTEL_RESOURCE_ATTRIBUTES`    | Effect        | Optional comma-separated resource attributes, for example `deployment.environment=production,team=data`.                   |

## Testing

For tests, the most common setup is:

- `StateStore.layerMemory` for state
- a small in-memory `Publisher.Publisher` test layer
- `Ingestion.run(...)` or `ConnectorApp.start(...)` inside `Effect.scoped`

Keep HTTP recording concerns outside connector logic by providing a VCR-backed `HttpClient` Layer.
