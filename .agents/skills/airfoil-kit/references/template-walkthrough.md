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
- `TemplateConfigDef` re-exported from `src/manifest.ts`
- `TemplateConnector`
- `make(config)`
- `layer(config)`
- `layerConfig(config)`

Current webhook authoring pattern:

- `Resource.entity({...})`
- required read-only resource `check` effects
- `Fetch.page({...})`
- `Resource.webhook({...})`
- `Webhook.route({...})`
- optional signature verification on raw body

Porting rules:

- set all template identifiers for the target service
- keep the typed connector service and its `layer` / `layerConfig` exports
- pass the connector service and `layerConfig` to `ConnectorApp.check` for pre-provision checks
- keep the connector runtime shape as a `ConnectorDefinition`
- keep exhaustive dispatch over payload types

## CLI runtime files

`src/main.ts` is CLI assembly:

```ts
const BootstrapLayer = Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer);

const program = Command.make("producer-template", {}, () => Effect.void).pipe(
  Command.withSubcommands([startCommand, sandboxCommand]),
);

Command.run(program, { version }).pipe(
  Effect.provide(BootstrapLayer),
  Effect.scoped,
  NodeRuntime.runMain,
);
```

`src/start.ts` contains production runtime wiring:

```ts
const RuntimeLayer = Layer.mergeAll(
  StateStore.layerSql().pipe(Layer.provide(PostgresLayer)),
  TemplateConnector.layerConfig(TemplateConfigDef.config),
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
  TemplateConnector.layerConfig(TemplateConfigDef.config),
  Logger.layer([Logger.consolePretty()]),
  TelemetryLayer,
);

// sandboxCommand calls ConnectorApp.start(...)
```

Porting rules:

- keep `main.ts` focused on CLI assembly
- keep `src/main.ts` in the `tsdown` entry list so `dist/main.js` is emitted
- keep production Wings/topic config in `start.ts`
- keep console publishing and sandbox-specific overrides in `sandbox.ts`
- use `<Service>ConfigDef.config` for production runtime config and `<Service>ConfigDef.fields` when a sandbox needs to override one field
- do not sibling-merge a dependency layer and assume it satisfies dependents

## `Dockerfile`

The template Dockerfile builds from the workspace root, runs the package's Nx
build, and uses `pnpm deploy --prod` for a pruned runtime. Rename its package
identifier when copying the template. Keep the Node 24 runtime non-root, retain
`ENTRYPOINT ["node", "dist/main.js"]`, and never add `.env` files or secrets.

## `src/manifest.ts`

Current shape:

- `TemplateConfigDef = Manifest.defineConfig({...})`
- `TemplateConfig = Manifest.ConfigValuesOf<typeof TemplateConfigDef>`
- `manifest = Manifest.define({...})`

Porting rules:

- keep user-facing connector config here, not in `connector.ts`
- give every field a `runtimeKey`; the platform maps logical form values to these keys in the connector config document
- use `Manifest.secret(...)` for credentials and unwrap with `Redacted.value(...)` only at HTTP/webhook boundaries
- use `Manifest.optional(...)` when absence is valid; use defaults for values the connector can safely choose

## `src/index.ts`

Current public surface:

- `TemplateApiClient`
- `TemplateConnector`
- `TemplateConfig`
- `TemplateConfigDef`
- `manifest`
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
