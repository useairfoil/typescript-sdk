# @useairfoil/connector-kit

Toolkit for building Airfoil connectors with Effect.

---

## User guide (build a connector)

This section is for connector authors who want to build and run a connector.

### Install

```bash
bun add @useairfoil/connector-kit
```

### Minimal example

```ts
import { Schema, Effect, Layer, Stream } from "effect";
import {
  defineConnector,
  defineEntity,
  Publisher,
  runConnector,
  StateStoreInMemory,
  WebhookServerLayer,
  makeWebhookQueue,
} from "@useairfoil/connector-kit";

const Customer = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  created_at: Schema.Date,
});

const program = Effect.gen(function* () {
  const webhook = yield* makeWebhookQueue<Schema.Schema.Type<typeof Customer>>();

  const connector = defineConnector({
    name: "producer-example",
    entities: [
      defineEntity({
        name: "customers",
        schema: Customer,
        primaryKey: "id",
        live: webhook.queue,
        backfill: Stream.empty,
      }),
    ],
    events: [],
  });

  yield* runConnector(connector, new Date());
}).pipe(
  Effect.provide(StateStoreInMemory),
  Effect.provide(
    Layer.succeed(Publisher, {
      publish: () => Effect.succeed({ requestId: 1n }),
    }),
  ),
  Effect.provide(
    WebhookServerLayer({
      port: 8080,
      routes: [
        {
          path: "/webhook/customers",
          schema: Customer,
          dispatch: (payload) =>
            Effect.succeed([
              {
                queue: webhook.queue,
                batch: { cursor: new Date(), rows: [payload] },
              },
            ]),
        },
      ],
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
- `WebhookServerLayer` turns webhook routes into an HTTP server.

### Layers and Effect services

Connector-kit is designed around Effect services and Layers. Your application should provide:

- a `Publisher` Layer
- a `StateStore` Layer
- an HTTP server Layer (if you use webhooks)
- any custom services your connector needs (API clients, Effect Config)

### Testing with VCR

VCR is provided via `@useairfoil/effect-vcr` as an Effect `HttpClient` layer. This keeps HTTP recording out of connector logic.

```ts
import { FetchHttpClient } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { Layer } from "effect";

const cassetteLayer = CassetteStoreLive.pipe(Layer.provide(NodeFileSystem.layer));

const vcrLayer = VcrHttpClientLayer({
  cassetteDir: "cassettes",
  cassetteName: "example",
  mode: "auto",
}).pipe(Layer.provide(Layer.mergeAll(FetchHttpClient.layer, cassetteLayer)));
```
