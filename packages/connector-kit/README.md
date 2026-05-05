# @useairfoil/connector-kit

Toolkit for building Airfoil connectors with Effect.

`@useairfoil/connector-kit` gives connector authors a small set of runtime primitives:

- connector definitions
- pull and webhook live sources
- webhook routing and payload decoding
- state persistence boundaries
- publisher boundaries
- an ingestion engine that runs entities and events

It is designed for connectors that:

- model data with Effect `Schema`
- ingest from polling, webhooks, or both
- publish batches to Airfoil or a custom destination
- run inside an Effect application with explicit Layers

## Install

```bash
pnpm add @useairfoil/connector-kit effect
```

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
  Streams,
  Webhook,
} from "@useairfoil/connector-kit";
```

Subpath exports are available for the runtime domains:

- `@useairfoil/connector-kit/ingestion`
- `@useairfoil/connector-kit/publisher`
- `@useairfoil/connector-kit/streams`
- `@useairfoil/connector-kit/webhook`
- `@useairfoil/connector-kit/errors`

Core definition helpers are intentionally root-only.

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

`Ingestion` contains the runtime engine and state-store boundary.

Common entry points:

- `Ingestion.runConnector`
- `Ingestion.StateStore`
- `Ingestion.layerMemory`

`Ingestion.runConnector(...)`:

- runs all entity and event ingestion flows
- merges entity live and backfill streams
- de-duplicates overlapping entity backfill rows already seen live
- runs event backfill before event live ingestion
- publishes through `Publisher.Publisher`
- persists state through `Ingestion.StateStore`
- optionally mounts webhook routes and a health endpoint

Use `Ingestion.layerMemory` for development and tests, or provide your own `StateStore` implementation for durable state.

## Publisher

`Publisher` contains the publishing boundary and packaged publisher implementations.

Common entry points:

- `Publisher.Publisher`
- `Publisher.layerWings`

`Publisher.Publisher` is the Effect service boundary for publishing batches.

The ingestion engine only advances state after publish acknowledgement succeeds.

Use `Publisher.layerWings(...)` when you want to publish directly to Wings topics.

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

- `Webhook.route`
- `Webhook.WebhookRoute`
- `Webhook.buildWebhookRouter`

### `Webhook.route`

Use `Webhook.route(...)` to define routes with schema-driven payload inference.

```ts
const route = Webhook.route({
  path: "/webhooks/example",
  schema: PayloadSchema,
  handle: (payload, request, rawBody) => {
    payload.id;
    return Effect.void;
  },
});
```

The `payload` type is inferred from the route `schema`, so most callers do not need to write `Webhook.WebhookRoute<...>` annotations manually.

### Route behavior

Webhook request handling does the following:

- reads the raw body as bytes
- decodes JSON
- validates the payload with Effect `Schema`
- passes the decoded payload, request, and raw body to the route handler
- returns `400` for invalid payloads
- returns `500` for handler failures

`Ingestion.runConnector(..., { webhook: { routes } })` automatically mounts:

- all provided POST routes
- a health endpoint at `/health` by default

You can override:

- `healthPath`
- `disableHttpLogger`

## Minimal Example

```ts
import { NodeHttpServer } from "@effect/platform-node";
import {
  defineConnector,
  defineEntity,
  Ingestion,
  Publisher,
  Streams,
  Webhook,
} from "@useairfoil/connector-kit";
import { Effect, Layer, Queue, Schema, Stream } from "effect";
import { createServer } from "node:http";

const Customer = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  created_at: Schema.Date,
});

const program = Effect.gen(function* () {
  const webhook = yield* Streams.makeWebhookQueue<Schema.Schema.Type<typeof Customer>>();

  const routes = [
    Webhook.route({
      path: "/webhook/customers",
      schema: Customer,
      handle: (payload) =>
        Queue.offer(webhook.queue, {
          cursor: new Date(),
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

  yield* Ingestion.runConnector(connector, {
    initialCutoff: new Date(),
    webhook: { routes },
  });
});

const runtimeLayer = Layer.mergeAll(
  NodeHttpServer.layer(createServer, { port: 8080 }),
  Ingestion.layerMemory,
  Layer.succeed(Publisher.Publisher)({
    publish: () => Effect.succeed({ success: true }),
  }),
);

Effect.runPromise(program.pipe(Effect.provide(runtimeLayer)));
```

## Typical Runtime Wiring

Your application usually provides:

- a `Publisher.Publisher` Layer
- an `Ingestion.StateStore` Layer
- an HTTP server Layer if webhook routes are enabled
- any API client and configuration Layers your connector needs

Compose the runtime layers first, then provide once:

```ts
const runtimeLayer = Layer.mergeAll(
  serverLayer,
  Ingestion.layerMemory,
  publisherLayer,
  connectorLayer,
);

program.pipe(Effect.provide(runtimeLayer));
```

## Using `Publisher.layerWings`

```ts
import { Ingestion, Publisher } from "@useairfoil/connector-kit";
import { Layer } from "effect";
import { WingsClient } from "@useairfoil/wings";

const publisherLayer = Publisher.layerWings({
  connector,
  topics: {
    customers: customerTopic,
  },
});

const runtimeLayer = Layer.mergeAll(
  WingsClient.layer({
    host: "localhost:7777",
    dataPlaneHost: "localhost:8815",
  }),
  Ingestion.layerMemory,
  publisherLayer,
);
```

`Publisher.layerWings(...)` expects:

- the connector definition
- a topic mapping keyed by entity or event name
- optional partition values keyed by entity or event name

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

- `Ingestion.layerMemory` for state
- a small in-memory `Publisher.Publisher` test layer
- `Ingestion.runConnector(...)` inside `Effect.scoped`

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
import { layerMemory } from "@useairfoil/connector-kit/ingestion";
import { layerWings } from "@useairfoil/connector-kit/publisher";
```
