# @useairfoil/connector-kit

Toolkit for building Airfoil producer connectors with Effect.

`@useairfoil/connector-kit` gives connector authors the pieces needed to define, run, test, and publish connector data:

- `defineConnector`, `defineEntity`, and `defineEvent` describe what a connector emits.
- `Streams` builds pull-based and webhook-backed live sources.
- `Webhook` defines schema-validated webhook routes.
- `Ingestion` runs connector streams and manages delivery semantics.
- `StateStore` stores cursor/checkpoint state.
- `Publisher` decides where ingested batches go.
- `ConnectorApp` starts a complete Node HTTP connector process.

The package is intentionally Layer-oriented: connector code defines data and routes, while entrypoints provide runtime dependencies such as publishers, state stores, telemetry, and API clients.

## Install

```bash
pnpm add @useairfoil/connector-kit effect@beta
```

This repo currently uses Effect v4 beta. In workspace packages, prefer the
workspace catalog (`"effect": "catalog:"`) so all packages stay on the pinned
beta version.

## What To Use

| Task                                | API                                                  |
| ----------------------------------- | ---------------------------------------------------- |
| Define connector metadata           | `defineConnector`, `defineEntity`, `defineEvent`     |
| Define webhook routes               | `Webhook.defineRoute(...)`                           |
| Build pull/webhook sources          | `Streams.makePullStream`, `Streams.makeWebhookQueue` |
| Run low-level ingestion             | `Ingestion.run(...)`                                 |
| Start a runnable connector process  | `ConnectorApp.start(...)`                            |
| Store cursors/checkpoints in memory | `StateStore.layerMemory`                             |
| Log batches locally                 | `Publisher.layerConsole`                             |
| Publish batches to Wings            | `Publisher.layerWings(...)`                          |
| Enable optional OTLP tracing        | `Telemetry.layerOtlpTracing(...)`                    |

Use `ConnectorApp.start(...)` in connector `main.ts` entrypoints. Use `Ingestion.run(...)` directly in tests or custom runtimes where you want to supply the HTTP server layer yourself.

## Package Shape

The package root exposes the common connector authoring API.

```ts
import {
  ConnectorError,
  defineConnector,
  defineEntity,
  defineEvent,
  Ingestion,
  Publisher,
  ConnectorApp,
  StateStore,
  Streams,
  Telemetry,
  Webhook,
} from "@useairfoil/connector-kit";
```

Subpath exports are available for runtime domains:

- `@useairfoil/connector-kit/ingestion`
- `@useairfoil/connector-kit/connector-app`
- `@useairfoil/connector-kit/publisher`
- `@useairfoil/connector-kit/state-store`
- `@useairfoil/connector-kit/streams`
- `@useairfoil/connector-kit/webhook`
- `@useairfoil/connector-kit/errors`

Core definition helpers and `Telemetry` are intentionally root-only.

## Core API

### `defineConnector`

Creates the top-level connector definition.

### `defineEntity`

Defines an entity with:

- a schema
- a primary key
- a live source
- a backfill stream
- an optional row transform

Entities are treated as upsert-style streams. The ingestion engine de-duplicates entity backfill rows that were already observed in live ingestion.

### `defineEvent`

Defines an event stream with:

- a schema
- a live source
- an optional backfill stream
- an optional row transform

Events preserve backfill-before-live ordering when backfill is provided.

### Exported core types

The root also exports the common shared types, including:

- `Batch`
- `Cursor`
- `EntityDefinition`
- `EventDefinition`
- `Transform`
- `ConnectorDefinition`

## Ingestion

`Ingestion` contains the runtime engine. `StateStore` contains the cursor/checkpoint storage boundary used by the ingestion engine.

Common entry points:

- `Ingestion.run`
- `StateStore` service tag
- `StateStore.layerMemory`

`Ingestion.run(...)`:

- runs all entity and event ingestion flows
- merges entity live and backfill streams
- de-duplicates overlapping entity backfill rows already seen live
- runs event backfill before event live ingestion
- publishes through `Publisher.Publisher`
- persists cursor/checkpoint state through the `StateStore` service
- optionally mounts webhook routes and a health endpoint

Use `StateStore.layerMemory` for development and tests, or provide your own `StateStore` implementation for durable state.

## ConnectorApp

`ConnectorApp` contains helpers for starting a complete connector process.

Common entry points:

- `ConnectorApp.start`
- `ConnectorApp.App`

`ConnectorApp.start(...)` starts the Node HTTP server, mounts webhook routes and the health endpoint, and calls `Ingestion.run(...)` with the connector app.

## Publisher

`Publisher` contains the publishing boundary and packaged publisher implementations.

Common entry points:

- `Publisher.Publisher`
- `Publisher.layerConsole`
- `Publisher.layerWings`

`Publisher.Publisher` is the Effect service boundary for publishing batches.

The ingestion engine only advances state after publish acknowledgement succeeds.

Use `Publisher.layerConsole` when you want to log batches locally. Use `Publisher.layerWings(...)` when you want to publish directly to Wings table names.

## Streams

`Streams` contains stream helpers for pull-based and webhook-based ingestion.

Common entry points:

- `Streams.makePullStream`
- `Streams.makeWebhookQueue`

### `Streams.makePullStream`

Builds a polling or backfill stream from a cursor-based page fetcher.

```ts
import { Streams } from "@useairfoil/connector-kit";

const backfill = Streams.makePullStream({
  initialCursor: undefined,
  fetchPage: (cursor) => fetchPage(cursor),
});
```

The fetcher returns:

- `cursor`
- `rows`
- `hasMore`

Empty pages are skipped until either rows arrive or `hasMore` becomes `false`.

### `Streams.makeWebhookQueue`

Creates a queue-backed live source for webhook ingestion.

```ts
const webhook = yield * Streams.makeWebhookQueue<MyPayload>({ capacity: 1024 });
```

This returns:

- `queue`: where the webhook handler offers batches
- `stream`: the live stream consumed by the ingestion engine

## Webhooks

`Webhook` contains the route type, the route helper, and the router builder.

Common entry points:

- `Webhook.defineRoute`
- `Webhook.Route`
- `Webhook.router`

### `Webhook.defineRoute`

Use `Webhook.defineRoute(...)` to define routes with schema-driven payload inference.

```ts
const route = Webhook.defineRoute({
  path: "/webhooks/example",
  schema: PayloadSchema,
  handle: (payload, request, rawBody) => {
    payload.id;
    return Effect.void;
  },
});
```

The `payload` type is inferred from the route `schema`, so most callers do not need to write `Webhook.Route<...>` annotations manually.

### Route behavior

Webhook request handling does the following:

- reads the raw body as bytes
- decodes JSON
- validates the payload with Effect `Schema`
- passes the decoded payload, request, and raw body to the route handler
- returns `400` for invalid payloads
- returns `500` for handler failures

`Ingestion.run(..., { webhook: { routes } })` automatically mounts:

- all provided POST routes
- a health endpoint at `/health` by default

You can override:

- `healthPath`
- `disableHttpLogger`

## Telemetry

`Telemetry` contains the connector-kit span names, span attributes, error annotation helpers, and OTLP tracing layers.

Common entry points:

- `Telemetry.SpanName`
- `Telemetry.Attr`
- `Telemetry.EventName`
- `Telemetry.EventAttr`
- `Telemetry.annotateError`
- `Telemetry.addCurrentSpanEvent`
- `Telemetry.layer`
- `Telemetry.layerConfig`
- `Telemetry.layerOtlpTracing`

### OTLP tracing layers

Three entry points cover the common usage patterns. All provide sensitive HTTP header redaction and export traces only; logs and metrics stay local.

**`Telemetry.layer`** — direct values, no `ConfigProvider` required. Useful for tests or hardcoded runtimes.

```ts
import { Telemetry } from "@useairfoil/connector-kit";

const TelemetryLayer = Telemetry.layer({
  enabled: true,
  endpoint: "http://localhost:4318",
  headers: { Authorization: "Bearer token" },
  redactedHeaders: ["x-shopify-access-token"],
});
```

**`Telemetry.layerConfig`** — Effect Config-wrapped values, reads from `ConfigProvider`. Use when you need custom env var names.

```ts
import { Telemetry } from "@useairfoil/connector-kit";
import { Config, ConfigProvider, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const TelemetryLayer = Telemetry.layerConfig(
  {
    enabled: Config.boolean("MY_OTEL_ENABLED"),
    endpoint: Config.string("MY_COLLECTOR_URL"),
  },
  { redactedHeaders: ["x-shopify-access-token"] },
).pipe(Layer.provide(EnvLayer));
```

**`Telemetry.layerOtlpTracing`** — zero-config shortcut that reads the standard `OTEL_*` env var names. This is what connector sandboxes use.

```ts
import { Telemetry } from "@useairfoil/connector-kit";
import { ConfigProvider, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const TelemetryLayer = Telemetry.layerOtlpTracing({
  redactedHeaders: ["x-shopify-access-token"],
}).pipe(Layer.provide(EnvLayer));
```

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

| Variable                      | Read by       | Description                                                                                                                   |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `OTEL_ENABLED`                | Connector Kit | Enables trace export when `true`. Defaults to `false`.                                                                        |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Connector Kit | OTLP base URL, for example `http://localhost:4318`. Connector Kit appends `/v1/traces`. Required when `OTEL_ENABLED=true`.    |
| `OTEL_EXPORTER_OTLP_HEADERS`  | Connector Kit | Optional comma-separated headers for the OTLP exporter, for example `Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>`. |
| `OTEL_SERVICE_NAME`           | Effect        | Service name resource attribute, for example `producer-shopify`.                                                              |
| `OTEL_SERVICE_VERSION`        | Effect        | Optional service version resource attribute.                                                                                  |
| `OTEL_RESOURCE_ATTRIBUTES`    | Effect        | Optional comma-separated resource attributes, for example `deployment.environment=production,team=data`.                      |

Example `.env`:

```env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>
OTEL_SERVICE_NAME=producer-example
OTEL_SERVICE_VERSION=0.1.0
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=development,team=data
```

Connector Kit reads the export toggle, endpoint, and exporter headers. Effect reads service/resource metadata while building the OTLP resource.

## Minimal Example

```ts
import { NodeRuntime } from "@effect/platform-node";
import {
  ConnectorApp,
  defineConnector,
  defineEntity,
  Publisher,
  StateStore,
  Streams,
  Telemetry,
  Webhook,
} from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer, Queue, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const Customer = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  created_at: Schema.Date,
});

const program = Effect.gen(function* () {
  const webhook = yield* Streams.makeWebhookQueue<Schema.Schema.Type<typeof Customer>>();

  const routes = [
    Webhook.defineRoute({
      path: "/webhook/customers",
      schema: Customer,
      handle: (payload) =>
        Queue.offer(webhook.queue, {
          cursor: payload.created_at,
          rows: [payload],
        }).pipe(Effect.asVoid),
    }),
  ];

  const connector = defineConnector({
    name: "producer-example",
    entities: [
      defineEntity({
        name: "customers",
        schema: Customer,
        primaryKey: "id",
        live: webhook,
        backfill: Stream.empty,
      }),
    ],
    events: [],
  });

  yield* ConnectorApp.start(
    { connector, routes },
    {
      port: 8080,
    },
  );
});

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const TelemetryLayer = Telemetry.layerOtlpTracing().pipe(Layer.provide(EnvLayer));

const runtimeLayer = Layer.mergeAll(StateStore.layerMemory, Publisher.layerConsole, TelemetryLayer);

Effect.scoped(program).pipe(Effect.provide(runtimeLayer), NodeRuntime.runMain);
```

## Typical ConnectorApp Wiring

Your application usually provides:

- a `Publisher.Publisher` Layer
- a `StateStore.StateStore` Layer, for example `StateStore.layerMemory`
- optionally a `Telemetry.layer(...)`, `Telemetry.layerConfig(...)`, or `Telemetry.layerOtlpTracing(...)` Layer for OTLP trace export
- `ConnectorApp.start(...)` when you want Connector Kit to create the HTTP server for webhook routes
- any API client and configuration Layers your connector needs

Compose the runtime layers first, then provide once:

```ts
const runtimeLayer = Layer.mergeAll(StateStore.layerMemory, publisherLayer, connectorLayer);

program.pipe(Effect.provide(runtimeLayer));
```

## Using `Publisher.layerWings`

```ts
import { WingsClient } from "@useairfoil/wings";
import { Publisher, StateStore } from "@useairfoil/connector-kit";
import { Config, Layer } from "effect";

const WingsConfig = Config.all({
  host: Config.string("WINGS_HOST"),
  namespace: Config.string("WINGS_NAMESPACE"),
});

const publisherLayer = Publisher.layerWings({
  connector,
  tables: {
    customers: "namespaces/default/tables/customers",
  },
});

const runtimeLayer = Layer.mergeAll(
  WingsClient.layerConfig(WingsConfig),
  StateStore.layerMemory,
  publisherLayer,
);
```

`Publisher.layerWings(...)` expects:

- the connector definition
- a table-name mapping keyed by entity or event name
- optional partition values keyed by entity or event name

Table names are resolved through the provided `WingsClient` during layer construction.

## State and Delivery Semantics

Current runtime behavior:

- entities merge live and backfill concurrently
- entities de-duplicate overlapping backfill rows using primary keys
- events process backfill before live
- publish acknowledgement must succeed before cursor state is persisted

This means a publisher rejection does not silently advance ingestion state.

## Errors

`ConnectorError` is the package-level runtime error type for connector flows.

Use it for:

- publisher failures
- connector-side transform failures
- state-store failures
- connector runtime failures that should stay in the Effect error channel

## Testing

For tests, the most common setup is:

- `StateStore.layerMemory` for state
- a small in-memory `Publisher.Publisher` test layer
- `Ingestion.run(...)` inside `Effect.scoped`

The package’s own tests use this style for ingestion behavior validation.

## HTTP Recording

If your connector uses `HttpClient`, keep recording concerns outside connector logic by providing a VCR-backed `HttpClient` Layer.

```ts
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-polar",
  mode: "auto",
}).pipe(
  Layer.provideMerge(FileSystemCassetteStore.layer()),
  Layer.provideMerge(FetchHttpClient.layer),
);
```

## Recommended Imports

Use root imports for:

- connector definition primitives
- the common runtime modules
- `ConnectorError`

Use subpath imports when you want to be explicit about a specific runtime domain, for example:

```ts
import { layerMemory } from "@useairfoil/connector-kit/state-store";
import { layerWings } from "@useairfoil/connector-kit/publisher";
```
