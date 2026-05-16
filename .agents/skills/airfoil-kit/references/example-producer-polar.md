# example-producer-polar

Walkthrough of `connectors/producer-polar/`. This is a reference connector for
multi-entity REST backfill and webhook dispatch. Also inspect current connector
source directly, especially `connectors/producer-shopify/`, when you need newer
GraphQL, strict-normalization, or product/webhook shape examples.

Use it as the example of:

- multiple entities
- real webhook verification
- current `make` / `layer` / `layerConfig(config)` naming
- current sandbox layer composition
- current VCR test runtime wiring

## File inventory

```text
connectors/producer-polar/
  src/
    api.ts
    connector.ts
    index.ts
    sandbox.ts
    schemas.ts
    streams.ts
  test/
    api.vcr.test.ts
    helpers.ts
    webhook.test.ts
    __cassettes__/
```

## `src/api.ts`

Current public surface:

- `PolarApiClient`
- `make(config)`
- `layer(config)`
- `layerConfig(config)`

Pattern:

- build the configured `HttpClient` once
- expose `fetchJson` and `fetchList`
- decode at the boundary
- map failures to `ConnectorError`

## `src/connector.ts`

Current public surface:

- `PolarConfig`
- `PolarConfigConfig`
- `PolarConnector`
- `make(config)`
- `layer(config)`
- `layerConfig`
- `PolarConnectorRuntime`

Important patterns:

- `PolarConnector` is a `Context.Service`
- `layerConfig(config)` decodes config and provides `PolarApiClient.layer(config)`
- routes are authored with `Webhook.route({...})`
- the route handler wraps connector-local handling in `Effect.withSpan(...)`
- signature verification uses the official Polar SDK helper
- ignored events are explicit, not implicit

## `src/streams.ts`

This file shows a generic stream helper shape:

- `resolveCursor`
- `dispatchEntityWebhook`
- `makeEntityStreams`

New connectors can keep provider-specific paging outside stream helpers by
passing a `fetchBackfillPage` callback, as in `producer-shopify`.

It also shows the current `Streams.*` namespaced connector-kit imports.

## `src/sandbox.ts`

This file is the current runtime reference for connectors.

Key points:

- `EnvLayer = Layer.mergeAll(FetchHttpClient.layer, ConfigProvider.fromEnv())`
- `ConnectorLayer = PolarConnector.layerConfig(PolarConnector.PolarConfigConfig).pipe(Layer.provide(EnvLayer))`
- `TelemetryLayer` is pre-provided with `EnvLayer`
- `RuntimeLayer` merges only already-satisfied layers
- entrypoint is `Effect.runPromise(Effect.scoped(program).pipe(Effect.provide(RuntimeLayer)))`

If you are unsure how to compose layers, copy this shape.

## `test/api.vcr.test.ts`

This is the current reference for VCR-backed API tests.

Key points:

- build `cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(Layer.provide(NodeServices.layer))`
- build `vcrRuntimeLayer = Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer, cassetteStoreLayer)`
- build `vcrLayer = VcrHttpClient.layer(...).pipe(Layer.provide(vcrRuntimeLayer))`
- provide `ConfigProvider.fromUnknown({ ... })` for hermetic config decode

## `test/webhook.test.ts`

This is the current reference for webhook tests.

Key points:

- stub the API service with `Layer.succeed(PolarApiClient)(...)`
- build `connectorLayer = layerConfig.pipe(Layer.provide(apiLayer))`
- use `NodeHttpServer.layerTest`
- fork `Ingestion.runConnector(...)`
- call the in-process route with `HttpClientRequest.post(...)`

## `README.md`

The README is the current style target for connector docs:

- present-state only
- public exports listed explicitly
- minimal runtime wiring example
- API-layer example
- webhook behavior
- testing commands
