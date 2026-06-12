# template-walkthrough

File-by-file tour of `templates/producer-template/`. The template targets
JSONPlaceholder so the code runs and tests pass without external credentials.

Use this as the starting point for any new connector.

## `package.json`

- set the package name to `@useairfoil/producer-<service>`
- keep it ESM
- keep `effect`, `@effect/*`, and `@useairfoil/effect-vcr` versions aligned
  with the workspace

## `src/schemas.ts`

- define entity schemas with `Schema.Struct(...)`
- define webhook payloads with `Schema.Struct(...)` or `Schema.Union([...])`
  depending on whether one route schema can safely distinguish all topics
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

## `src/connector.ts`

Current shape:

- `TemplateConfig`
- `TemplateConfigConfig`
- `TemplateConnector`
- `make(config)`
- `layer(config)`
- `layerConfig(config)`

Current webhook authoring pattern:

- `Resource.entity({...})`
- `Fetch.page({...})`
- `Resource.webhook({...})`
- `Webhook.route({...})`
- optional signature verification on raw body

Porting rules:

- set all template identifiers for the target service
- keep `layerConfig(config)`
- keep the connector runtime shape as a `ConnectorDefinition`
- keep exhaustive dispatch over payload types

## CLI runtime files

`src/main.ts` is CLI assembly:

```ts
const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  NodeServices.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const program = Command.make("producer-template", {}, () => Effect.void).pipe(
  Command.withSubcommands([startCommand, sandboxCommand]),
);

Command.run(program, { version }).pipe(
  Effect.provide(EnvLayer),
  Effect.scoped,
  NodeRuntime.runMain,
);
```

`src/start.ts` contains production runtime wiring:

```ts
const RuntimeLayer = Layer.mergeAll(
  StateStore.layerMemory,
  ConnectorLayer,
  WingsClient.layerConfig(WingsConfig),
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
);

// startCommand calls ConnectorApp.start(...) and provides Publisher.layerWings(...)
```

`src/sandbox.ts` contains local runtime wiring:

```ts
const RuntimeLayer = Layer.mergeAll(
  StateStore.layerMemory,
  Publisher.layerConsole,
  ConnectorLayer,
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
);

// sandboxCommand calls ConnectorApp.start(...)
```

Porting rules:

- keep `main.ts` focused on CLI assembly
- keep production Wings/topic config in `start.ts`
- keep console publishing and sandbox-specific overrides in `sandbox.ts`
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
3. build a connector test layer with stub API service and test config provider
4. fork `Ingestion.run(...)`
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
