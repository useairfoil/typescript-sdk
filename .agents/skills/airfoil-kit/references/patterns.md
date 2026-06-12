# patterns

Patterns shared by `templates/producer-template/` and current producer connectors
such as `connectors/producer-polar/` and `connectors/producer-shopify/`. This
file is the current implementation contract for connector code in this repo.

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

- raw-config layers: `layer(config)`
- config-decoded layers: `layerConfig(Config.Wrap<...>)`
- constructors: `make(config)`
- entrypoints: `export * as XApiClient from "./api"` and
  `export * as XConnector from "./connector"`
- connector runtime: a `ConnectorDefinition`
- webhook routes: `Webhook.route({...})`
- connector runner: `Ingestion.run(...)`
- in-memory state layer: `StateStore.layerMemory`
- publisher service tag: `Publisher.Publisher`

Avoid stale names like:

- `XApiClientConfig`
- `XConnectorConfig()`
- `Ingestion.run` root imports
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

export const make = Effect.fnUntraced(function* (
  config: XConfig,
): Effect.fn.Return<XApiClientService, ConnectorError, HttpClient.HttpClient> {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
  );

  return { fetchJson, fetchList };
});

export const layer = (
  config: XConfig,
): Layer.Layer<XApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(XApiClient)(make(config));

export const layerConfig = (
  config: Config.Wrap<XConfig>,
): Layer.Layer<XApiClient, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(XApiClient)(Config.unwrap(config).asEffect().pipe(Effect.flatMap(make)));
```

Keep transport policy here:

- auth headers
- base URL prefixing
- response decode
- pagination mapping
- transport/decode error mapping

## 5. Connector layer shape

Use `layerConfig(config)` to decode config and build the connector service.

```ts
export const make = Effect.fnUntraced(function* (
  config: XConfig,
): Effect.fn.Return<XConnectorRuntime, ConnectorError, XApiClient> {
  // ...
});

export const layer = (
  config: XConfig,
): Layer.Layer<XConnector, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(XConnector)(make(config).pipe(Effect.provide(XApiClient.layer(config))));

export const layerConfig = (
  config: Config.Wrap<XConfig>,
): Layer.Layer<XConnector, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(XConnector)(
    Config.unwrap(config)
      .asEffect()
      .pipe(
        Effect.flatMap((config) => make(config).pipe(Effect.provide(XApiClient.layer(config)))),
      ),
  );
```

This layer:

- reads config itself
- builds the API client from the decoded config
- narrows failures to `ConnectorError`

## 6. Resource fetch pattern

Define resources directly in `src/connector.ts` with `Resource.entity(...)`.

```ts
const Customers = Resource.entity({
  name: "customers",
  schema: CustomerSchema,
  key: "id",
  version: "updated_at",
  backfill: Fetch.page({
    pageCursor: Cursor.number(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor, cutoff }) =>
      api.fetchCustomers({ page: typeof pageCursor === "number" ? pageCursor : 1, cutoff }).pipe(
        Effect.map((page) => ({
          mutations: page.items.map(Resource.upsert),
          nextPageCursor: page.hasMore ? page.nextPage : page.page,
          hasMore: page.hasMore,
        })),
      ),
  }),
});
```

## 7. Webhook route pattern

Always author connector-level routes with `Webhook.route({...})`.

```ts
const webhookRoute = Webhook.route({
  path: "/webhooks/x",
  ackMode: "after-publish",
  schema: WebhookPayloadSchema,
  handler: ({ request, rawBody, payload, to }) =>
    Effect.gen(function* () {
      if (Option.isSome(config.webhookSecret)) {
        yield* verifyWebhookSignature({ rawBody, request, secret: config.webhookSecret.value });
      }

      switch (payload.type) {
        case "customer.created":
        case "customer.updated":
          yield* to(Customers, payload);
          break;
        default:
          yield* Effect.logWarning("Ignoring unknown webhook type").pipe(
            Effect.annotateLogs({ type: payload.type }),
          );
      }

      return HttpServerResponse.jsonUnsafe({ ok: true });
    }),
});
```

Rules:

- verify signatures before side effects
- fail closed when verification is enabled but inputs are missing
- use raw request bytes when the platform requires raw-byte signing
- return an explicit HTTP response after routing or intentionally ignoring events

## 8. Exhaustive dispatch

Dispatch webhook events through an explicit switch.

```ts
switch (payload.type) {
  case "product.created":
  case "product.updated":
    yield * to(Customers, payload);
    break;
  case "unrelated.event":
    break;
  default:
    yield *
      Effect.logWarning("Ignoring unknown webhook type").pipe(
        Effect.annotateLogs({ type: (payload as { type: string }).type }),
      );
    break;
}
```

## 9. Layer semantics: `mergeAll` vs `provide`

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

## 11. CLI runtime shape

`src/main.ts` shape:

```ts
const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  NodeServices.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const program = Command.make("producer-x", {}, () => Effect.void).pipe(
  Command.withSubcommands([startCommand, sandboxCommand]),
);

Command.run(program, { version }).pipe(
  Effect.provide(EnvLayer),
  Effect.scoped,
  NodeRuntime.runMain,
);
```

`src/start.ts` shape:

```ts
const ConnectorLayer = XConnector.layerConfig(XConnector.XConfigConfig);

const TelemetryLayer = Telemetry.layerOtlpTracing({
  redactedHeaders: ["x-provider-token"],
});

export const startCommand = Command.make("start", {}, () =>
  Effect.gen(function* () {
    const runtimeConfig = yield* RuntimeConfig;
    const tableConfig = yield* TablesConfig;
    const entrypoint = yield* XConnector.XConnector;

    return yield* ConnectorApp.start(entrypoint, {
      port: runtimeConfig.port,
      healthPath: "/health",
    }).pipe(
      Effect.provide(
        Publisher.layerWings({
          connector: entrypoint.connector,
          tables: { rows: tableConfig.rows },
        }),
      ),
    );
  }).pipe(Effect.provide(RuntimeLayer)),
);
```

`src/sandbox.ts` shape:

```ts
const ConnectorLayer = XConnector.layerConfig(XConnector.XConfigConfig);

const TelemetryLayer = Telemetry.layerOtlpTracing({
  redactedHeaders: ["x-provider-token"],
});

const RuntimeLayer = Layer.mergeAll(
  StateStore.layerMemory,
  Publisher.layerConsole,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
);

export const sandboxCommand = Command.make("sandbox", {}, () =>
  Effect.gen(function* () {
    const runtimeConfig = yield* RuntimeConfig;
    const entrypoint = yield* XConnector.XConnector;

    return yield* ConnectorApp.start(entrypoint, {
      port: runtimeConfig.port,
      healthPath: "/health",
    });
  }).pipe(Effect.provide(RuntimeLayer)),
);
```

## 12. VCR test wiring shape

Current `effect-vcr` shape:

```ts
const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-x",
  mode: "auto",
}).pipe(
  Layer.provide(FileSystemCassetteStore.layer()),
  Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
);
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
