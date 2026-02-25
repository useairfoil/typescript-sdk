# @useairfoil/connector-kit

Toolkit for building Wings connectors with Effect.

## Example

```ts
const Customer = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  created_at: Schema.Date,
});

const program = Effect.gen(function* () {
  const webhook = yield* makeWebhookQueue<Schema.Schema.Type<typeof Customer>>();

  const connector = defineConnector({
    name: "producer-polar",
    config: { apiKey: "example" },
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

## Testing with VCR

The VCR utilities let you record outgoing HTTP responses and replay them in
tests for deterministic runs.

```ts
import { ConnectorError } from "@useairfoil/connector-kit";
import {
  makeVcrFetch,
  type VcrConfig,
} from "@useairfoil/connector-kit/vcr";
import { Effect } from "effect";

const vcrConfig: VcrConfig = {
  cassetteDir: "./cassettes",
  cassetteName: "customers-backfill",
  mode: "auto",
  matchIgnore: {
    requestHeaders: ["authorization"],
  },
  redact: {
    requestHeaders: ["authorization"],
  },
};

const realFetch = (request: { method: string; url: string }) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(request.url, { method: request.method });
      return { status: response.status, body: await response.text() };
    },
    catch: (error) =>
      new ConnectorError({ message: "VCR real fetch failed", cause: error }),
  });

const program = Effect.gen(function* () {
  const vcrFetch = yield* makeVcrFetch(vcrConfig, realFetch);
  const response = yield* vcrFetch({ method: "GET", url: "https://api" });
  console.log(response.status);
});
```
