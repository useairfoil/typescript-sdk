# connector-kit-api

Exhaustive reference for every export of
[`@useairfoil/connector-kit`](../../../packages/connector-kit/).

Import from the package root:

```ts
import {
  ConnectorError,
  defineConnector,
  defineEntity,
  defineEvent,
  makePullStream,
  makeWebhookQueue,
  Publisher,
  runConnector,
  StateStore,
  StateStoreInMemory,
  WingsPublisherLayer,
  ConnectorRuntimeContext,
  ConnectorRuntimeContextLayer,
  buildWebhookRouter,
} from "@useairfoil/connector-kit";

import type {
  BackfillStream,
  Batch,
  ConnectorDefinition,
  Cursor,
  EntityDefinition,
  EntityKey,
  EntityRow,
  EntitySchema,
  EntityType,
  EventDefinition,
  IngestionState,
  LiveSource,
  LiveStream,
  RunConnectorOptions,
  StreamState,
  Transform,
  WebhookRoute,
  WebhookStream,
} from "@useairfoil/connector-kit";
```

All items are re-exported from
[`packages/connector-kit/src/index.ts`](../../../packages/connector-kit/src/index.ts).

---

## Core types

### `Cursor`

```ts
type Cursor = string | number | bigint | Date;
```

Opaque watermark emitted by a stream. Use the same shape across a stream's
live and backfill branches so `IngestionState` stays consistent.

### `Batch<T>`

```ts
type Batch<T> = {
  readonly cursor: Cursor;
  readonly rows: ReadonlyArray<T>;
};
```

Unit of ingestion. The engine publishes one batch at a time, then persists
the cursor after a successful publish.

### `StreamState<C>` / `IngestionState<C>`

```ts
type StreamState<C = Cursor> = {
  readonly cutoff: C;
  readonly current?: C;
};

type IngestionState<C = Cursor> = {
  readonly backfill: StreamState<C>;
  readonly live: StreamState<C>;
};
```

Persisted by `StateStore`. `cutoff` is the watermark that delimits live vs
backfill. `current` advances each time a batch is published.

### `Transform<T>`

```ts
type Transform<T> = (row: T) => Effect.Effect<T, ConnectorError>;
```

Optional per-row transformer. Applied after decoding, before publish. Use
it to enrich rows with joined data.

### `LiveStream<T>` / `BackfillStream<T>`

Both are type aliases for `Stream.Stream<Batch<T>, ConnectorError>`.

### `WebhookStream<T>`

```ts
type WebhookStream<T> = {
  readonly queue: Queue.Queue<Batch<T>>;
  readonly stream: Stream.Stream<Batch<T>, ConnectorError>;
};
```

Returned by `makeWebhookQueue`. The webhook handler calls
`Queue.offer(stream.queue, ...)`; the engine consumes from `stream.stream`.

### `LiveSource<T>`

```ts
type LiveSource<T> = LiveStream<T> | WebhookStream<T>;
```

An entity's `live` field accepts either a regular `Stream` (polling) or a
`WebhookStream` (event-driven). The engine detects the webhook shape by
checking for `queue` + `stream` fields.

### Schema utility types

```ts
type EntitySchema = Schema.Schema<unknown>;
type EntityType<S extends EntitySchema> = Schema.Schema.Type<S>;
type EntityKey<S extends EntitySchema> = ...;       // "id" | "email" | ...
type EntityRow<S extends EntitySchema> = ...;       // intersect with Record<string, unknown>
```

Use `EntityType` to derive row types (`type Customer = EntityType<typeof CustomerSchema>`).

### `EntityDefinition<S>`

```ts
type EntityDefinition<S extends EntitySchema> = {
  readonly name: string;
  readonly schema: S;
  readonly primaryKey: EntityKey<S>;
  readonly live: LiveSource<EntityRow<S>>;
  readonly backfill: BackfillStream<EntityRow<S>>;
  readonly transform?: Transform<EntityRow<S>>;
};
```

Entities are upserts: live and backfill can overlap. The engine tracks a
`Set<string>` of primary keys already emitted so backfill does not re-publish
rows seen live.

### `EventDefinition<S>`

Same shape as `EntityDefinition` but:

- `primaryKey` is absent.
- `backfill` is optional.
- The engine runs `backfill` **to completion** before starting `live`.

Use for append-only log streams where order matters and upserts do not apply.

### `ConnectorDefinition<Entities, Events>`

```ts
type ConnectorDefinition = {
  readonly name: string;
  readonly entities: ReadonlyArray<EntityDefinition<any>>;
  readonly events: ReadonlyArray<EventDefinition<any>>;
};
```

---

## Errors

### `ConnectorError`

```ts
class ConnectorError extends Data.TaggedError("ConnectorError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
```

Single error channel for connector code. Wrap upstream errors with
`Effect.mapError((cause) => new ConnectorError({ message, cause }))`.

---

## Builders

### `defineConnector(definition)`

```ts
const connector = defineConnector({
  name: "producer-foo",
  entities: [defineEntity({ ... })],
  events: [],
});
```

Identity function with inference hints; `const` generics preserve literal
names and entity arrays. Always use it rather than object literals.

### `defineEntity<S>(definition)`

Returns the input with correct inference. `S` is inferred from
`definition.schema`, so `primaryKey` autocompletes from the schema's decoded
shape.

### `defineEvent<S>(definition)`

Same, for events (`EventDefinition<S>`).

---

## Runtime

### `runConnector(connector, options?)`

Two overloads:

```ts
// No webhook: requires StateStore + Publisher
runConnector(
  connector,
  options?: { initialCutoff?: Cursor; webhook?: undefined },
): Effect.Effect<void, ConnectorError, StateStore | Publisher>;

// With webhook: also requires HttpServer
runConnector<TPayload>(
  connector,
  options: {
    initialCutoff?: Cursor;
    webhook: {
      routes: ReadonlyArray<WebhookRoute<TPayload>>;
      healthPath?: HttpRouter.PathInput;  // default "/health"
      disableHttpLogger?: boolean;         // default true
    };
  },
): Effect.Effect<void, ConnectorError, StateStore | Publisher | HttpServer.HttpServer>;
```

Internally:

- Provides `ConnectorRuntimeContextLayer(connector)` so downstream spans can
  tag metrics with `connector.name`.
- Wraps the whole run in an `Effect.withSpan("connector.run", ...)`.
- Emits `connector_batches_total`, `connector_rows_total`, and
  `connector_batch_size` via `effect/Metric`.
- For webhooks, composes `buildWebhookRouter(routes)` with a `/health`
  route and serves it via `HttpRouter.serve(app, { disableLogger })`.

### `RunConnectorOptions<TWebhookPayload>`

Exposed type for callers who build options programmatically.

---

## State persistence

### `StateStore` (service tag)

```ts
class StateStore extends ServiceMap.Service<StateStore, {
  readonly getState: (
    key: string,
  ) => Effect.Effect<IngestionState<Cursor> | undefined, ConnectorError>;
  readonly setState: (
    key: string,
    state: IngestionState<Cursor>,
  ) => Effect.Effect<void, ConnectorError>;
}>()("StateStore") {}
```

Keyed by entity/event name. One row per stream.

### `StateStoreInMemory`

In-process `Map<string, IngestionState>` backed `StateStore` layer. Use for
the sandbox runner and tests. Production deployments provide a durable
implementation (e.g. backed by a key-value store).

---

## Publishing

### `Publisher` (service tag)

```ts
class Publisher extends ServiceMap.Service<Publisher, {
  readonly publish: (options: {
    readonly name: string;
    readonly source: "live" | "backfill";
    readonly batch: Batch<Record<string, unknown>>;
  }) => Effect.Effect<PublishAck, ConnectorError>;
}>()("Publisher") {}
```

`PublishAck = { readonly success: boolean }`. The engine fails the stream
if `publish` fails.

### `WingsPublisherLayer(config)`

```ts
WingsPublisherLayer({
  connector,
  topics: { customers: customerTopic, orders: orderTopic },
  partitionValues: { customers: "account_id" },
}): Layer.Layer<Publisher, ConnectorError, Wings.WingsClient.WingsClient>;
```

Production-grade publisher that fans each entity into a Wings topic. For
the sandbox / tests, use a hand-written console publisher instead.

---

## Streams

### `makeWebhookQueue<T>(options?)`

```ts
makeWebhookQueue<T>({ capacity?: number }): Effect.Effect<WebhookStream<T>>;
```

Creates a bounded `Queue` (default capacity 1024) and its `Stream.fromQueue`
view. Always keep the queue bounded — unbounded queues can let a noisy
webhook drown the publisher.

### `makePullStream<T, R>(options)`

```ts
makePullStream({
  initialCursor?: Cursor,
  fetchPage: (cursor: Cursor | undefined) => Effect.Effect<PullPage<T>, ConnectorError, R>,
}): Stream.Stream<Batch<T>, ConnectorError, R>;

type PullPage<T> = {
  readonly cursor: Cursor;
  readonly rows: ReadonlyArray<T>;
  readonly hasMore: boolean;
};
```

Paging unfold. Skips empty pages automatically (keeps fetching until rows
arrive or `hasMore: false`). Use for every backfill that pages through a
list endpoint.

---

## Webhooks

### `WebhookRoute<TPayload>`

```ts
type WebhookRoute<TPayload> = {
  readonly path: HttpRouter.PathInput;
  readonly schema: Schema.Schema<TPayload>;
  readonly handle: (
    payload: TPayload,
    request: HttpServerRequest.HttpServerRequest,
    rawBody?: Uint8Array,
  ) => Effect.Effect<void, ConnectorError>;
};
```

The framework decodes the request body, validates against `schema`, and
invokes `handle(payload, request, rawBody)`. Use `rawBody` for HMAC
verification; use `payload` for dispatch.

### `buildWebhookRouter(routes)`

Low-level helper that turns an array of routes into an `HttpRouter` Layer.
`runConnector(...)` uses this internally; you rarely call it directly.

---

## Runtime context

### `ConnectorRuntimeContext`

Service tag exposing `{ connector: ConnectorDefinition }`. The engine sets
this via `ConnectorRuntimeContextLayer(connector)`. Metrics attributes use
it to tag batches with `connector.name`.

### `ConnectorRuntimeContextLayer(connector)`

Returns a `Layer.succeed(ConnectorRuntimeContext)({ connector })`. Call this
in custom test harnesses if you bypass `runConnector`.

---

## Observability (provided by the engine)

### Spans

- `connector.run` wraps the whole connector (attributes: `connector.name`,
  `connector.entities.count`, `connector.events.count`).
- `connector.batch.process` wraps each batch publish (attributes:
  `connector.name`, `connector.stream.name`, `connector.stream.source`,
  `connector.batch.rows`).

### Metrics

- `connector_batches_total` (counter).
- `connector_rows_total` (counter).
- `connector_batch_size` (histogram,
  `boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000]`).

All three carry `connector`, `stream`, and `source` (`live` | `backfill`)
attributes.

To export telemetry, provide an Effect observability layer (the Polar
sandbox uses `Observability.Otlp.layerJson({ baseUrl, resource })` from
`effect/unstable/observability` plus `Metric.enableRuntimeMetricsLayer`).

---

## Typical composition recipe

```ts
const runtimeLayer = Layer.mergeAll(
  StateStoreInMemory,
  ConsolePublisherLayer,       // or WingsPublisherLayer(...)
  MyConnectorConfig(),         // Layer<MyConnector, ConnectorError, HttpClient>
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,              // optional
  Layer.mergeAll(
    FetchHttpClient.layer,
    Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
  ),
);

const program = Effect.gen(function* () {
  const { connector, routes } = yield* MyConnector;
  return yield* runConnector(connector, {
    initialCutoff: new Date(),
    webhook: { routes },
  }).pipe(Effect.provide(BunHttpServer.layer({ port: 8080 })));
});

Effect.runPromise(Effect.scoped(program).pipe(Effect.provide(runtimeLayer)));
```

See `connectors/producer-polar/src/sandbox.ts` for the live reference.
