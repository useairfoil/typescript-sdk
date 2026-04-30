# patterns

Patterns shared by `templates/producer-template/` and
`connectors/producer-polar/`. This file is the current implementation contract
for connector code in this repo.

---

## 1. Config struct vs individual fields

Use one `Config.all({...})` that produces a flat config struct. Pass that struct
into downstream factories. Do not read `ConfigProvider` from deep inside API
helpers or stream code.

```ts
export const XConfigConfig = Config.all({
  apiBaseUrl: Config.string("X_API_BASE_URL"),
  apiToken: Config.string("X_API_TOKEN"),
  webhookSecret: Config.option(Config.string("X_WEBHOOK_SECRET")),
});
```

Use:

- `Config.string(...)`
- `Config.option(...)`
- `Config.withDefault(...)`
- `Config.port(...)`
- `Config.boolean(...)`

Do not use `process.env` in connector code or tests.

## 2. Service tag per logical component

Every connector usually has these services:

- `XApiClient`
- `XConnector`
- optional service-specific helpers when the API genuinely needs them

String tags should use package scope:

```ts
export class XApiClient extends Context.Service<XApiClient, XApiClientService>()(
  "@useairfoil/producer-x/XApiClient",
) {}

export class XConnector extends Context.Service<XConnector, XConnectorRuntime>()(
  "@useairfoil/producer-x/XConnector",
) {}
```

Do not collapse unrelated responsibilities into one service tag.

## 3. Current naming conventions

Use the current repo names.

- raw-config API client layer: `layerApiClient(config)`
- config-decoded connector layer: `layerConfig`
- connector runtime: `{ connector, routes }`
- webhook routes: `Webhook.route({...})`
- connector runner: `Ingestion.runConnector(...)`
- in-memory state layer: `Ingestion.layerMemory`
- publisher service tag: `Publisher.Publisher`

Avoid stale names like:

- `XApiClientConfig`
- `XConnectorConfig()`
- `runConnector` root imports
- `StateStoreInMemory`

## 4. API client layer shape

Use a typed service plus a raw-config layer factory.

```ts
export type XApiClientService = {
  readonly fetchJson: <A, R>(
    schema: Schema.Decoder<A, R>,
    path: string,
    params?: Record<string, string>,
  ) => Effect.Effect<A, ConnectorError, R>;
  readonly fetchList: <A, R>(
    schema: Schema.Decoder<A, R>,
    path: string,
    options: XListOptions,
  ) => Effect.Effect<XListPage<A>, ConnectorError, R>;
};

export class XApiClient extends Context.Service<XApiClient, XApiClientService>()(
  "@useairfoil/producer-x/XApiClient",
) {}

export const makeXApiClient = (
  config: XConfig,
): Effect.Effect<XApiClientService, ConnectorError, HttpClient.HttpClient> =>
  Effect.fnUntraced(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
      HttpClient.mapRequest(HttpClientRequest.acceptJson),
    );

    return { fetchJson, fetchList };
  })();

export const layerApiClient = (
  config: XConfig,
): Layer.Layer<XApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(XApiClient)(makeXApiClient(config));
```

Keep transport policy here:

- auth headers
- base URL prefixing
- response decode
- pagination mapping
- transport/decode error mapping

## 5. Connector layer shape

Use `layerConfig` to decode config and build the connector service.

```ts
export const layerConfig: Layer.Layer<XConnector, ConnectorError, HttpClient.HttpClient> =
  Layer.effect(XConnector)(
    Effect.fnUntraced(function* () {
      const config = yield* XConfigConfig;
      return yield* makeXConnector(config).pipe(Effect.provide(layerApiClient(config)));
    })().pipe(
      Effect.mapError((error) =>
        error instanceof ConnectorError
          ? error
          : new ConnectorError({
              message: "X config failed",
              cause: error,
            }),
      ),
    ),
  );
```

This layer:

- reads config itself
- builds the API client from the decoded config
- narrows failures to `ConnectorError`

## 6. Entity stream trio

For entity connectors, always build the same trio:

- `live`
- `cutoff`
- `backfill`

```ts
const streams =
  yield *
  makeEntityStreams({
    api,
    schema: CustomerSchema,
    path: "/customers",
    cursorField: "updated_at",
    limit: 100,
  });
```

That returns:

- `live: Streams.WebhookStream<T>`
- `cutoff: Deferred<Cursor, never>`
- `backfill: Stream<Batch<T>, ConnectorError>`

## 7. First-live-event sets cutoff

For webhook-driven entity streams, the first live event establishes the cutoff.
Backfill waits on that cutoff so historical data does not overlap the live side.

```ts
export const dispatchEntityWebhook = <T extends Record<string, unknown>>(options: {
  readonly queue: Streams.WebhookStream<T>;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly row: T;
  readonly cursor: Cursor;
}): Effect.Effect<void, never> =>
  Effect.fnUntraced(function* () {
    yield* Deferred.succeed(options.cutoff, options.cursor).pipe(Effect.asVoid);
    return yield* Queue.offer(options.queue.queue, {
      cursor: options.cursor,
      rows: [options.row],
    }).pipe(Effect.asVoid);
  })();
```

## 8. Webhook route pattern

Always author routes with `Webhook.route({...})`.

```ts
const webhookRoute = Webhook.route({
  path: "/webhooks/x",
  schema: WebhookPayloadSchema,
  handle: (payload, request, rawBody) =>
    Effect.fn("x/webhook/handle")(function* () {
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
          request,
          secret: config.webhookSecret.value,
        });
      }

      return yield* resolveWebhookDispatch({ payload, streams });
    })(),
});
```

Rules:

- verify signatures before side effects
- fail closed when verification is enabled but inputs are missing
- use raw request bytes when the platform requires raw-byte signing
- return `Effect.void` for intentionally ignored event types

## 9. Exhaustive dispatch

Dispatch webhook events through an explicit switch.

```ts
switch (payload.type) {
  case "product.created":
  case "product.updated":
    return yield* dispatchEntityWebhook(...)
  case "unrelated.event":
    return Effect.void
  default:
    return Effect.logWarning("Ignoring unknown webhook type").pipe(
      Effect.annotateLogs({ type: (payload as { type: string }).type }),
      Effect.asVoid,
    )
}
```

## 10. Layer semantics: `mergeAll` vs `provide`

This is the most important Effect composition rule in the repo.

- `Layer.mergeAll(...)` is for independent layers.
- `Layer.provide(...)` satisfies a dependent layer's requirements.
- `Layer.provideMerge(...)` satisfies requirements and also keeps the provided
  outputs exposed downstream.

Correct:

```ts
const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const ConnectorLayer = layerConfig.pipe(Layer.provide(EnvLayer));
```

Incorrect:

```ts
const RuntimeLayer = Layer.mergeAll(layerConfig, EnvLayer);
```

The incorrect example only merges the layers side-by-side. It does not use
`EnvLayer` to build `layerConfig`.

If an entrypoint still appears to require `HttpClient`, `Path`, or
`ConfigProvider`, inspect the layer graph before reaching for a cast.

## 11. Sandbox runner shape

Current sandbox shape:

```ts
const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const ConnectorLayer = layerConfig.pipe(Layer.provide(EnvLayer));

const TelemetryLayer = Layer.unwrap(
  Effect.gen(function* () {
    const telemetry = yield* TelemetryConfig;
    if (!telemetry.enabled) {
      return Layer.empty;
    }

    return Layer.mergeAll(
      Observability.Otlp.layerJson({
        baseUrl: telemetry.baseUrl,
        resource: { serviceName: telemetry.serviceName },
      }),
      Metric.enableRuntimeMetricsLayer,
    );
  }),
).pipe(Layer.provide(EnvLayer));

const RuntimeLayer = Layer.mergeAll(
  Ingestion.layerMemory,
  ConsolePublisherLayer,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
);

Effect.runPromise(Effect.scoped(program).pipe(Effect.provide(RuntimeLayer)));
```

## 12. VCR test wiring shape

Current `effect-vcr` shape:

```ts
const cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(Layer.provide(NodeServices.layer));

const vcrRuntimeLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  NodeServices.layer,
  cassetteStoreLayer,
);

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-x",
  mode: "replay",
}).pipe(Layer.provide(vcrRuntimeLayer));
```

Why:

- `FileSystemCassetteStore.layer()` needs platform filesystem + `Path`
- `VcrHttpClient.layer(...)` needs live `HttpClient`, `Path`, and a cassette
  store service
- pre-provide dependencies before use; do not assume sibling merges satisfy them

## 13. Test publisher

Use a `makeTestPublisher(expected)` helper that buffers rows into a `Ref` and
resolves a `Deferred` after the expected number of deliveries.

Do not rely on timeouts to decide a connector is idle.

## 14. Error mapping

Wrap non-`ConnectorError` failures into `ConnectorError` at layer boundaries.

```ts
Effect.mapError((error) =>
  error instanceof ConnectorError
    ? error
    : new ConnectorError({
        message: "X config failed",
        cause: error,
      }),
);
```

## 15. Verification order

When doing non-trivial refactors or export changes, use this order:

```bash
pnpm install
pnpm --filter @useairfoil/producer-<service> build
pnpm --filter @useairfoil/producer-<service> typecheck
pnpm --filter @useairfoil/producer-<service> test:ci
pnpm exec oxfmt --check <paths>
pnpm exec oxlint <paths>
```

If a package surface changes, build it before downstream typechecks so workspace
resolution sees the current shape.
