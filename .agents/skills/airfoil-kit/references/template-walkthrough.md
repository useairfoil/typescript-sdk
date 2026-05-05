# template-walkthrough

File-by-file tour of `templates/producer-template/`. The template targets
JSONPlaceholder so the code runs and tests pass without external credentials.

Use this as the starting point for any new connector.

## `package.json`

- rename the package to `@useairfoil/producer-<service>`
- keep it ESM
- keep `effect`, `@effect/*`, and `@useairfoil/effect-vcr` versions aligned
  with the workspace

## `src/schemas.ts`

- define entity schemas with `Schema.Struct(...)`
- define webhook payloads with `Schema.Union([...])`
- derive types from real traffic, not memory

## `src/api.ts`

Current shape:

- `TemplateApiClientService`
- `TemplateApiClient`
- `make(config)`
- `layer(config)`
- `layerConfig(config)`

Porting rules:

- keep the service shape
- replace auth middleware
- replace pagination mapping inside `fetchList`
- decode at the API boundary with `Schema.decodeUnknownEffect(...)`
- map failures to `ConnectorError`

## `src/streams.ts`

Current shape:

- `resolveCursor(...)`
- `dispatchEntityWebhook(...)`
- `makeBackfillStream(...)`
- `makeEntityStreams(...)`

Porting rules:

- keep the live/cutoff/backfill trio
- change cursor semantics to match the target API
- keep webhook dispatch generic and small

## `src/connector.ts`

Current shape:

- `TemplateConfig`
- `TemplateConfigConfig`
- `TemplateConnector`
- `make(config)`
- `layer(config)`
- `layerConfig(config)`

Current webhook authoring pattern:

- `Webhook.route({...})`
- `Effect.fn("template/webhook/handle")(... )`
- optional signature verification on raw body

Porting rules:

- rename all template identifiers
- keep `layerConfig(config)`
- keep the connector runtime shape `{ connector, routes }`
- keep exhaustive dispatch over payload types

## `src/sandbox.ts`

Current runtime shape:

```ts
const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
)

const ConnectorLayer = TemplateConnector.layerConfig(TemplateConnector.TemplateConfigConfig).pipe(
  Layer.provide(EnvLayer),
)

const TelemetryLayer = Layer.unwrap(...).pipe(Layer.provide(EnvLayer))

const RuntimeLayer = Layer.mergeAll(
  Ingestion.layerMemory,
  ConsolePublisherLayer,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
)
```

Porting rules:

- keep this dependency graph
- rename env vars and logging labels only
- do not sibling-merge a dependency layer and assume it satisfies dependents

## `src/index.ts`

Current public surface:

- `TemplateApiClient`
- `TemplateConnector`
- `TemplateConfig`
- `TemplateConfigConfig`
- `TemplateConnectorRuntime`
- `Post`
- `PostSchema`
- `WebhookPayload`
- `WebhookPayloadSchema`

Keep the public surface small and present-state.

## `test/helpers.ts`

Keep the test publisher helper shape. It is reusable across connectors.

## `test/api.vcr.test.ts`

Current test shape:

1. build a program that uses the API client service directly
2. build `apiLayer`
3. build `cassetteStoreLayer`
4. build `vcrRuntimeLayer`
5. build `vcrLayer`
6. provide `ConfigProvider.fromUnknown({ ... })`

VCR wiring should match the current `effect-vcr` runtime pattern exactly.

## `test/webhook.test.ts`

Current test shape:

1. use `NodeHttpServer.layerTest`
2. build a stub API layer
3. build `connectorLayer = layerConfig.pipe(Layer.provide(apiLayer))`
4. fork `Ingestion.runConnector(...)`
5. post to the in-process webhook route
6. await the `Deferred` from the test publisher

This is the standard webhook test shape for new connectors.

## `README.md`

Document the connector in present-state terms:

- public exports
- env/config
- minimal runtime wiring
- webhook behavior
- API client layer
- testing

Avoid migration framing and avoid explaining old names.
