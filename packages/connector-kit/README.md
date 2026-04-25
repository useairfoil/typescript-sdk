# @useairfoil/connector-kit

Toolkit for building Airfoil connectors with Effect.

---

## User guide (build a connector)

This section is for connector authors who want to build and run a connector.

### Install

```bash
pnpm add @useairfoil/connector-kit
```

### Minimal example

This snippet uses Node. Bun is also supported by swapping in Bun's HttpServer
layer.

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { Schema, Effect, Layer, Queue, Stream } from "effect";
import { createServer } from "node:http";
import {
  type WebhookRoute,
  defineConnector,
  defineEntity,
  Publisher,
  runConnector,
  StateStoreInMemory,
  makeWebhookQueue,
} from "@useairfoil/connector-kit";

const Customer = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  created_at: Schema.Date,
});

const program = Effect.gen(function* () {
  const webhook = yield* makeWebhookQueue<Schema.Schema.Type<typeof Customer>>();

  const routes: ReadonlyArray<WebhookRoute<Schema.Schema.Type<typeof Customer>>> = [
    {
      path: "/webhook/customers",
      schema: Customer,
      handle: (payload) =>
        Queue.offer(webhook.queue, {
          cursor: new Date(),
          rows: [payload],
        }).pipe(Effect.asVoid),
    },
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

  yield* runConnector(connector, {
    initialCutoff: new Date(),
    webhook: { routes },
  });
}).pipe(
  Effect.provide(NodeHttpServer.layer(createServer, { port: 8080 })),
  Effect.provide(StateStoreInMemory),
  Effect.provide(
    Layer.succeed(Publisher, {
      publish: () => Effect.succeed({ success: true }),
    }),
  ),
);

Effect.runPromise(program);
```

---

## Development (concepts and architecture)

### Core concepts

- `defineConnector` describes your connector and its entities.
- `defineEntity` wires live and backfill streams for each entity.
- `Publisher` is the output boundary (where batches go).
- `StateStore` tracks cursors and backfill state.
- `runConnector(..., { webhook: { routes } })` wires webhook routes and health endpoint into the HTTP runtime you provide.

### Layers and Effect services

Connector-kit is designed around Effect services and Layers. Your application should provide:

- a `Publisher` Layer
- a `StateStore` Layer
- an HTTP server Layer (if you pass webhook routes to `runConnector`)
- any custom services your connector needs (API clients, Effect Config)

`runConnector` automatically provides connector runtime context for internal
tracing/metrics annotations.

### Testing with VCR

VCR is provided via `@useairfoil/effect-vcr` as an Effect `HttpClient` layer. This keeps HTTP recording out of connector logic.

```ts
import { FetchHttpClient } from "effect/unstable/http";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { Layer } from "effect";

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-polar",
  mode: "auto",
}).pipe(
  Layer.provideMerge(FileSystemCassetteStore.layer()),
  Layer.provideMerge(FetchHttpClient.layer),
);
```
