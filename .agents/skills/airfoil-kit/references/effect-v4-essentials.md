# effect-v4-essentials

The SDK is pinned to Effect v4 beta (`effect@4.0.0-beta.54`). This file is the
short list of Effect rules and idioms that matter for connector work in this
repo.

Primary upstream reference for Effect-specific questions:

- `https://github.com/Effect-TS/effect-smol`

Use that repo as the source of truth when checking naming, layer semantics,
service patterns, and current HTTP/Config APIs.

Do not use the older official Effect docs as authority for this repo right now.
They lag the APIs and examples we are actually using. If `effect-smol` and the
older official docs disagree, follow `effect-smol`.

## 1. Core rules

1. Use `Context.Service` for repo services.
2. Use `Effect.fnUntraced` for library and hot-path helpers.
3. Use `return yield*` for terminal effects inside generators.
4. Do not use `try/catch` inside `Effect.gen`.
5. Use `layer` / `layerConfig` naming conventions where appropriate.
6. Use `Layer.provide(...)` to satisfy dependencies; do not assume sibling
   `Layer.mergeAll(...)` layers satisfy each other.
7. Prefer composing layers up front and doing one final `Effect.provide(...)`
   at the effect site.

## 2. Services

```ts
export type MyApiClientService = {
  readonly fetchJson: (path: string) => Effect.Effect<unknown, ConnectorError>;
};

export class MyApiClient extends Context.Service<MyApiClient, MyApiClientService>()(
  "@useairfoil/producer-foo/MyApiClient",
) {}
```

Use the package-scoped string identifier form:

- `@useairfoil/producer-foo/MyApiClient`
- `@useairfoil/producer-foo/MyConnector`

## 3. Config

```ts
export const MyConfigConfig = Config.all({
  apiBaseUrl: Config.string("FOO_API_BASE_URL"),
  apiToken: Config.string("FOO_API_TOKEN"),
  webhookSecret: Config.option(Config.string("FOO_WEBHOOK_SECRET")),
});
```

Runtime wiring:

```ts
const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);
```

Never use `process.env` in connector code or tests.

## 4. API client layer

```ts
export const make = Effect.fnUntraced(function* (
  config: MyConfig,
): Effect.fn.Return<MyApiClientService, ConnectorError, HttpClient.HttpClient> {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
  );

  return { fetchJson, fetchList };
});

export const layer = (
  config: MyConfig,
): Layer.Layer<MyApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(MyApiClient)(make(config));

export const layerConfig = (
  config: Config.Wrap<MyConfig>,
): Layer.Layer<MyApiClient, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(MyApiClient)(Config.unwrap(config).asEffect().pipe(Effect.flatMap(make)));
```

Keep transport policy here:

- auth
- base URL
- decode
- pagination mapping
- retry/timeout choices
- error mapping

## 5. Connector layer

```ts
export const make = Effect.fnUntraced(function* (
  config: MyConfig,
): Effect.fn.Return<MyConnectorRuntime, ConnectorError, MyApiClient> {
  // ...
});

export const layer = (
  config: MyConfig,
): Layer.Layer<MyConnector, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(MyConnector)(make(config).pipe(Effect.provide(MyApiClient.layer(config))));

export const layerConfig = (
  config: Config.Wrap<MyConfig>,
): Layer.Layer<MyConnector, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(MyConnector)(
    Config.unwrap(config)
      .asEffect()
      .pipe(
        Effect.flatMap((config) => make(config).pipe(Effect.provide(MyApiClient.layer(config)))),
      ),
  );
```

Current repo naming is:

- API and connector modules export `make`, `layer(config)`, and
  `layerConfig(Config.Wrap<...>)`
- package entrypoints export namespaces, for example
  `export * as MyApiClient from "./api"`

Avoid stale names like `XApiClientConfig` and `XConnectorConfig()`.

## 6. Layer semantics

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

`Layer.mergeAll(...)` combines independent layers. It does not satisfy sibling
layer dependencies.

Use:

- `Layer.provide(depLayer)` to satisfy a dependent layer
- `Layer.provideMerge(depLayer)` when you also want `depLayer`'s outputs kept
  in the resulting layer

## 7. Generators

Use `Effect.gen(function* () { ... })` for orchestration.

Use `Effect.fnUntraced(function* () { ... })()` for reusable library helpers.

Always terminate explicitly:

```ts
if (!rawBody) {
  return yield * Effect.fail(new ConnectorError({ message: "Webhook raw body is required" }));
}
```

Do not write:

```ts
yield* Effect.fail(...)
```

without `return` in a terminal branch.

## 8. Error handling

Expected failures should use typed error channels.

Good:

```ts
Effect.mapError(
  (cause) =>
    new ConnectorError({
      message: "Shopify API request failed",
      cause,
    }),
);
```

Allowed synchronous wrapper when calling ambient code that may throw:

```ts
Effect.try({
  try: () => validateSignature(...),
  catch: (cause) =>
    new ConnectorError({
      message: "Webhook verification failed",
      cause,
    }),
})
```

Do not use `Effect.die(...)` for expected connector failures.

## 9. Webhooks

Use `Webhook.route({...})`.

Signature verification rules:

- verify before side effects
- use raw request bytes when required by provider docs
- fail closed if verification is enabled and inputs are missing
- log a warning, do not crash, when the secret is intentionally unset in local
  development

## 10. Runtime shape

```ts
const program = Effect.gen(function* () {
  const { connector, routes } = yield* MyConnector;
  const serverLayer = NodeHttpServer.layer(createServer, { port: 8080 });

  return yield* Ingestion.runConnector(connector, {
    initialCutoff: new Date(),
    webhook: {
      routes,
      healthPath: "/health",
      disableHttpLogger: true,
    },
  }).pipe(Effect.provide(serverLayer));
});

const RuntimeLayer = Layer.mergeAll(
  Ingestion.layerMemory,
  ConsolePublisherLayer,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
);

Effect.runPromise(Effect.scoped(program).pipe(Effect.provide(RuntimeLayer)));
```

## 11. VCR runtime shape

```ts
const cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(Layer.provide(NodeServices.layer));

const vcrRuntimeLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  NodeServices.layer,
  cassetteStoreLayer,
);

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-foo",
  mode: "replay",
}).pipe(Layer.provide(vcrRuntimeLayer));
```

## 12. Tests

Prefer:

- build a focused test layer up front
- do one final `Effect.provide(...)`
- use `NodeHttpServer.layerTest` for webhook tests
- use VCR replay tests for API client paths

Avoid hiding missing dependencies behind `as Effect.Effect<...>` casts. If a
cast seems necessary, inspect the layer graph first.
