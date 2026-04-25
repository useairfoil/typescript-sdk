# patterns

Patterns shared by `templates/producer-template/` and
`connectors/producer-polar/`. For each pattern this file explains: what it
is, when to deviate, and where to look in the existing code.

---

## 1. Config struct vs individual fields

**Pattern:** a single `Config.all({...})` that produces a flat struct. Pass
the decoded struct into downstream factories (`makeXApiClient(config)`),
never reach into `ConfigProvider` from deep inside the connector.

**Deviate when:** none. Even for large configs, keep one struct.

**See:** `PolarConfigConfig`, `TemplateConfigConfig`.

## 2. Service tag per logical component

Three service tags per connector:

- `XApiClient` — HTTP-level operations.
- `XConnector` — the `{ connector, routes }` pair.
- (Optional) `XOAuthTokens` — refreshing tokens, if applicable.

Each tag lives in the file that owns the logic, with a string tag of the
form `@useairfoil/producer-<name>/<TagName>`.

**Deviate when:** never merge unrelated responsibilities into one tag.

## 3. Layer factories return `Layer.effect(Tag)(factory)`

```ts
export const XConnectorConfig = (): Layer.Layer<
  XConnector,
  ConnectorError,
  HttpClient.HttpClient
> =>
  Layer.effect(XConnector)(
    Effect.gen(function* () {
      const config = yield* XConfigConfig;
      return yield* makeXConnector(config).pipe(Effect.provide(XApiClientConfig(config)));
    }),
  );
```

- The layer **requires** whatever its factories need (`HttpClient` here).
- It reads config itself, so callers only supply the `ConfigProvider`.
- Error channel is narrowed to `ConnectorError` via `Effect.mapError`.

## 4. API client with `fetchJson` + `fetchList`

```ts
type XApiClientService = {
  readonly fetchJson: <A, R>(schema, path, params?) => Effect.Effect<A, ConnectorError, R>;
  readonly fetchList: <A, R>(
    schema,
    path,
    options,
  ) => Effect.Effect<XListPage<A>, ConnectorError, R>;
};
```

- `fetchJson` for detail fetches and non-list endpoints.
- `fetchList` encapsulates the pagination convention. Return
  `{ items, hasMore, ...maybeCursor }` — whatever your API communicates.
- Derive pagination semantics from official platform docs and validate against
  recorded traffic. Do not assume cursor or continuation behavior from another
  connector.

**Deviate when:** your API is GraphQL (replace GET with POST + query),
bulk-export based (replace `fetchList` with a job runner), or returns
protocol buffers (add a `fetchBytes` helper that decodes).

## REST mode summary (default)

For REST APIs, treat this file + `example-auth.md` +
`example-pagination.md` as the mode contract.

- Keep list/detail access in `fetchJson` and `fetchList` helpers.
- Keep auth middleware in one client construction pipeline.
- Keep pagination mapping deterministic and isolated in `fetchList`.
- Decode response bodies at the API boundary using `Schema`.
- Map all transport/decode failures to `ConnectorError`.

If your API is not REST, switch to mode-specific docs:

- GraphQL: `api-mode-graphql.md`
- gRPC: `api-mode-grpc.md`

## 5. Entity stream trio: `{ live, cutoff, backfill }`

Always wire every entity with `makeEntityStreams({ api, schema, path, cursorField })`.
The returned trio has exactly the shape the engine expects:

- `live`: `WebhookStream<T>` — pushed to by the webhook handler.
- `cutoff`: `Deferred<Cursor, never>` — resolved by the first live event
  (or by initialCutoff for polling-only connectors).
- `backfill`: `Stream<Batch<T>, ConnectorError>` — waits on cutoff, then pages.

**Deviate when:**

- Pure polling — skip `WebhookStream`, use `makePullStream` as `live` and
  point `initialCutoff` at the desired history window.
- Webhook-only — return an empty backfill stream.

## 6. First-webhook-sets-cutoff

The first live event dispatched to an entity resolves its `Deferred<Cursor>`.
Backfill waits on that deferred, so it can only run historical data that
happened **before** the first live event. This guarantees no overlap gap.

```ts
export const dispatchEntityWebhook = <T>(options) =>
  Effect.gen(function* () {
    yield* setCutoff(options.cutoff, options.cursor); // idempotent
    yield* Queue.offer(options.queue.queue, {
      cursor: options.cursor,
      rows: [options.row],
    }).pipe(Effect.asVoid);
  });
```

**Deviate when:** your connector is polling-only (no live events);
`initialCutoff` passed to `runConnector` becomes the canonical cutoff.

## 7. Seen-set for upsert de-dupe

The engine tracks a `Set<string>` of primary keys that have already been
published (live or backfill). Backfill filters its rows through that set
before emitting, so overlapping windows don't re-publish the same row.

This is implemented inside `runEntity` in
`packages/connector-kit/src/ingestion/engine.ts`. You don't need to do
anything in connector code.

## 8. Events run backfill then live (order matters)

For `defineEvent` streams, the engine drains the entire backfill before
starting live. Events are append-only logs; ordering must be preserved.

**Deviate when:** you want overlap (which would violate ordering) — in
that case, use `defineEntity` instead.

## 9. Webhook handler pattern

```ts
const webhookRoute: WebhookRoute<WebhookPayload> = {
  path: "/webhooks/<service>",
  schema: WebhookPayloadSchema,
  handle: (payload, request, rawBody) =>
    Effect.gen(function* () {
      if (Option.isSome(config.webhookSecret)) {
        if (!rawBody) {
          return yield* Effect.fail(
            new ConnectorError({
              message: "Webhook raw body is required for signature verification",
            }),
          );
        }
        yield* verifyWebhookSignature({
          rawBody,
          headers: request.headers,
          secret: config.webhookSecret.value,
        });
      }
      yield* resolveWebhookDispatch({ payload /* ...streams */ });
    }),
};
```

Key points:

- `Schema.Union([...])` validates the payload structure against known types.
- Raw body is used for signature verification.
- Verification is fail-closed when enabled: missing verification inputs are
  explicit typed failures.
- Dispatch logic is extracted into a pure function for testability.

## 10. Explicit enumeration of ignored events

`producer-polar` lists every ignored event type in a dedicated
`Schema.Literals([...])` union. Unknown types fall through to a
`logWarning` default. This is deliberate: silent schema failures are
nightmare to debug.

```ts
switch (payload.type) {
  case "order.created":
    return handleOrder(...);
  case "organization.updated": // ignored on purpose
    return Effect.void;
  default:
    return Effect.logWarning("Ignoring unknown webhook type").pipe(...);
}
```

**Deviate when:** the service has hundreds of event types — then group
into a dispatch table `const handlers: Record<string, Handler>`.

## 11. Sandbox runner layer composition

Always the same shape:

```ts
const RuntimeLayer = Layer.mergeAll(
  StateStoreInMemory,
  ConsolePublisherLayer,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
  EnvLayer, // FetchHttpClient.layer + ConfigProvider.fromEnv()
);
```

Callers toggle telemetry via `ACK_TELEMETRY_ENABLED` and choose the
publisher via which layer they merge in (console vs Wings).

## 12. Test publisher

Always `makeTestPublisher(expected)` that captures into a `Ref` and
resolves a `Deferred` after `expected` batches land. Never count on
timeouts to decide "the connector is idle now".

## 13. Error mapping

Wrap every non-`ConnectorError` failure:

```ts
Effect.mapError((error) =>
  error instanceof ConnectorError
    ? error
    : new ConnectorError({
        message: "<what failed>",
        cause: error,
      }),
);
```

Without this, `Layer.effect` will complain that the error channel isn't
narrowed, and `runConnector`'s contract (`E = ConnectorError`) won't hold.

## 14. Connector config ↔ test config

In sandbox/prod, `EnvLayer` provides `ConfigProvider.fromEnv()`.

In tests, use either:

- `ConfigProvider.fromUnknown({ ... })` for hermetic deterministic tests, or
- `ConfigProvider.fromEnv()` for integration-style tests that intentionally use
  environment-backed settings.

Pick one deliberately and keep `test` and `test:ci` behavior equivalent.

---

## Shape of a connector-kit test

```
┌───────────────┐
│ Test body     │  runs the Effect program
│ (Effect.gen)  │
└───────┬───────┘
        │ requires
┌───────▼───────────────────────────────────────────────┐
│ connectorLayer = XConnectorConfig().pipe(             │
│   Layer.provide(apiLayer OR vcrLayer)                 │
│ )                                                     │
└───────┬───────────────────────────────────────────────┘
        │ requires
┌───────▼───────────────────┐      ┌────────────────────┐
│ apiLayer: Layer<Api, …,   │  OR  │ vcrLayer + cassette│
│ HttpClient>               │      │ + real HttpClient  │
└───────────────────────────┘      └────────────────────┘
```

Plus `ConfigProvider` and `StateStoreInMemory` / `test publisher` as
needed. Polar has working examples for both shapes.
