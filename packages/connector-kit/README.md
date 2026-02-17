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
