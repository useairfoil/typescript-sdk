# @useairfoil/connector-kit

Toolkit for building Airfoil producer connectors with Effect.

`@useairfoil/connector-kit` gives connector authors the pieces needed to define, run, test, and publish resource-first producer connectors:

- `Connector.define(...)` describes a connector.
- `Resource.entity(...)` describes a Wings table-backed resource.
- `Fetch.page(...)` and `Fetch.changes(...)` describe backfill and polling fetches.
- `Resource.webhook(...)` lets a resource normalize provider webhook payloads into mutations.
- `Webhook.route(...)` defines connector-level HTTP webhook routes.
- `Ingestion.run(...)` runs resource ingestion and checkpoints after accepted publishes.
- `Publisher.layerConsole` logs accepted batches locally.
- `Publisher.layerWings(...)` publishes resource mutations into Wings tables.
- `ConnectorApp.check(...)` validates selected resources before provisioning.
- `ConnectorApp.start(...)` starts a complete Node HTTP connector process.
- `Auth.makeTokenCache(...)` caches short-lived provider access tokens in memory.

The package is intentionally Layer-oriented: connector code defines resources and routes, while entrypoints provide runtime dependencies such as publishers, state stores, telemetry, and API clients.

## Install

```bash
pnpm add @useairfoil/connector-kit effect@^4.0.0-rc.108
```

This repo currently uses the Effect v4 release candidate. In workspace packages, prefer the workspace catalog (`"effect": "catalog:"`) so all packages stay on the supported RC version.

## Package Shape

The package root exposes the common connector authoring API:

```ts
import {
  Auth,
  Connector,
  ConnectorApp,
  ConnectorError,
  Cursor,
  Fetch,
  Ingestion,
  Manifest,
  Metrics,
  Publisher,
  Resource,
  RuntimeConfig,
  StateStore,
  Status,
  Telemetry,
  Webhook,
} from "@useairfoil/connector-kit";
```

Subpath exports are available for runtime domains:

- `@useairfoil/connector-kit/auth`
- `@useairfoil/connector-kit/ingestion`
- `@useairfoil/connector-kit/connector-app`
- `@useairfoil/connector-kit/manifest`
- `@useairfoil/connector-kit/metrics`
- `@useairfoil/connector-kit/publisher`
- `@useairfoil/connector-kit/runtime-config`
- `@useairfoil/connector-kit/state-store`
- `@useairfoil/connector-kit/status`
- `@useairfoil/connector-kit/webhook`
- `@useairfoil/connector-kit/errors`

Core definition helpers and `Telemetry` are intentionally root-only.

## Provider Credentials

`Auth.makeTokenCache(...)` wraps a provider token exchange with Effect's cache. Acquisition stays lazy, concurrent callers share one exchange, and failures are not cached. The default refresh point is halfway through the provider lifetime.

```ts
import { Auth } from "@useairfoil/connector-kit";
import { Duration, Effect, Redacted } from "effect";

const tokenCache =
  yield *
  Auth.makeTokenCache({
    acquire: exchangeCredentials.pipe(
      Effect.map(({ accessToken, expiresInSeconds }) => ({
        value: Redacted.make(accessToken),
        expiresIn: Duration.seconds(expiresInSeconds),
      })),
    ),
  });

const accessToken = yield * tokenCache.get;
```

The cache is process-local and does not use `StateStore`. It does not add retries or background refresh. The first request after the refresh point performs the next exchange.

## Manifests

Connector manifests are pure metadata for UI, Wings deployment, and validation. Put user-facing connector config in `src/manifest.ts` and keep platform-owned runtime config, such as ports, Wings host, table names, and OTEL flags, as normal Effect `Config` in entrypoints.

```ts
import * as Manifest from "@useairfoil/connector-kit/manifest";

export const ExampleConfigDef = Manifest.defineConfig({
  apiBaseUrl: Manifest.string({
    runtimeKey: "EXAMPLE_API_BASE_URL",
    required: false,
    default: "https://api.example.test",
  }),
  apiToken: Manifest.secret({ runtimeKey: "EXAMPLE_API_TOKEN" }),
  maxRetries: Manifest.number({
    runtimeKey: "EXAMPLE_MAX_RETRIES",
    default: 5,
    integer: true,
    minimum: 0,
  }),
  webhookSecret: Manifest.optional(Manifest.secret({ runtimeKey: "EXAMPLE_WEBHOOK_SECRET" })),
});

export type ExampleConfig = Manifest.ConfigValuesOf<typeof ExampleConfigDef>;

export const manifest = Manifest.define({
  name: "producer-example",
  title: "Example",
  config: ExampleConfigDef.spec,
  resources: [{ name: "posts", capabilities: ["backfill", "webhook"] }],
});
```

`ExampleConfigDef.config` is the runtime Effect config. `ExampleConfigDef.spec` is serializable manifest metadata. `required` defaults to `true`. Number fields may set `integer` and `minimum`; Effect Schema applies the same constraints to runtime and form values. Use `required: false` with a default when the form may omit a field but the runtime must always receive a concrete value. Use `Manifest.optional(...)` when the runtime result should be an `Option`. Secret fields cannot declare defaults, so optional secrets use `Manifest.optional(Manifest.secret(...))`.

Use `Manifest.configSchema(manifest)` for form validation and `Schema.toStandardSchemaV1(...)` for standard-schema form resolvers. The schema accepts normal JSON values and browser form-shaped values: number fields may arrive as strings, boolean fields may arrive as booleans or `"true"`/`"false"`, optional fields may be omitted or submitted as `""`, and required strings reject `""`.

Use `Manifest.decodeConfig(manifest, input)` as the canonical server-side decoder. It rejects undeclared fields, treats `""` on a declared optional field as not supplied, and then applies manifest defaults. Therefore clearing or omitting a defaulted optional control means “use the manifest default”; it does not disable that setting. Model disabling as an explicit select/boolean/nullable contract instead of overloading an empty string. An optional field without a default remains absent.

Frontend/backend validation example:

```ts
import * as Manifest from "@useairfoil/connector-kit/manifest";
import { manifest as polarManifest } from "@useairfoil/producer-polar/manifest";
import { Schema } from "effect";

const configSchema = Manifest.configSchema(polarManifest);
const formSchema = Schema.toStandardSchemaV1(configSchema);

const result = await formSchema["~standard"].validate({
  accessToken: "polar_oat_xxx",
  apiBaseUrl: "https://api.polar.sh/v1/",
  organizationId: "",
});

if ("issues" in result) {
  // Show validation issues in your form.
} else {
  // Store by manifest field name: accessToken, apiBaseUrl, organizationId.
  // Secrets should be persisted server-side and not echoed back to the browser.
  const values = result.value;
}
```

Render fields from `manifest.config`: use `field.name` as the form/storage key, `field.description` for help text, `field.secret` for password inputs/redaction, `field.values` for selects, `field.default` for the documented fallback, `field.required` for required markers, and number `integer` and `minimum` values for input constraints. The UI may show a default as an initial value or clearly labelled placeholder, but clearing it still resolves to that default during canonical decoding. Decode submitted values with `Manifest.decodeConfig(...)`, then map the canonical logical object to its flat runtime document with `Manifest.toRuntimeDocument(...)`. Each `field.runtimeKey` is an Effect Config key, not an instruction to create one Pod environment variable.

Hosted connectors receive the runtime document as a read-only JSON file. `AIRFOIL_CONFIG_PATH` selects the file, and `RuntimeConfig.layerHosted()` adds the file beneath Effect's existing environment provider. The file is required and must contain valid JSON; each connector's Effect Config validates the fields it reads. Local sandboxes use Effect's default environment provider. Platform-owned config such as Wings host, namespace, table names, PostgreSQL settings, ports, and OTEL settings stays outside the manifest and outside the connector JSON.

### Pre-provision Checks

The dashboard backend imports each connector package and runs `ConnectorApp.check(...)` after manifest decoding but before persisting secrets or creating database and Kubernetes resources. Validate submitted resource names against `manifest.resources` at the request boundary before calling the typed check API. Replace the backend process provider with the submitted runtime document so unrelated backend environment variables cannot satisfy connector configuration:

```ts
import { ConnectorApp, Manifest } from "@useairfoil/connector-kit";
import { PolarConnector, manifest } from "@useairfoil/producer-polar";
import { ConfigProvider, Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const values = yield * Manifest.decodeConfig(manifest, submittedConfig);
const runtimeDocument = Manifest.toRuntimeDocument(manifest, values);
const provider = ConfigProvider.fromUnknown(runtimeDocument, { preserveEmptyStrings: true });

const result =
  yield *
  ConnectorApp.check(
    PolarConnector.PolarConnector,
    PolarConnector.layerConfig(PolarConnector.PolarConfigDef.config),
    { resources: ["customers", "orders"] },
  ).pipe(Effect.provide(ConfigProvider.layer(provider)), Effect.provide(FetchHttpClient.layer));
```

Every resource declares a required, read-only `check` effect. Layer/configuration failures are returned for every selected resource; resource-specific failures are returned only under that resource name. Expected failures are values (`{ _tag: "error", message }`), while defects and interruption remain Effect failures. Provision only when all selected results are `{ _tag: "ok" }`. Checks must never publish, checkpoint, or mutate the upstream provider.

`RuntimeConfig.PlatformRuntimeKey` is the canonical shared-key contract used by hosted config, StateStore, telemetry, Wings, and PostgreSQL bootstrap code. `Manifest.defineConfig` rejects only those exact shared values; it does not impose connector-specific naming, uniqueness, or metadata policy. Connector packages are first-party code, so their table, port, field, and resource naming remains the connector author's responsibility.

## Resource Model

Resources emit mutations, not raw rows. Connector Kit currently supports `Resource.entity(...)` for Wings table-backed resources.

```ts
const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
  check: api.fetchPosts({ page: 1, limit: 1 }).pipe(Effect.asVoid),
  backfill: Fetch.page({
    pageCursor: Cursor.number(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor }) =>
      api.fetchPosts({ page: typeof pageCursor === "number" ? pageCursor : 1 }).pipe(
        Effect.map((page) => ({
          mutations: page.items.map(Resource.upsert),
          nextPageCursor: page.hasMore ? page.nextPage : page.page,
          hasMore: page.hasMore,
        })),
      ),
  }),
});
```

`key` and `version` autocomplete from the decoded schema row type. Invalid field names are rejected at compile time.

Mutations are created with:

```ts
Resource.upsert(row);

Resource.delete({
  key: "post_123",
  version: "2026-01-01T00:00:00.000Z",
});
```

## Fetches

`Fetch.page(...)` is for paginated backfill. It receives the stored page cursor and the resource cutoff.

`Fetch.changes(...)` is for polling incremental changes. It receives the stored changes cursor and can be configured with an interval.

Cursor helpers:

- `Cursor.string()`
- `Cursor.number()`
- `Cursor.isoDateTime()`
- `Cursor.nowIsoDateTime`

Date cursor values are accepted at API boundaries and normalized to ISO strings before checkpoint writes.

## Webhooks

Webhooks are connector-level routes with schema-validated payloads. A route dispatches to resource-owned webhook handlers by calling `to(resource, payload)`.

```ts
const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
  check: Effect.void,
  webhook: Resource.webhook({
    schema: PostEventSchema,
    handler: ({ payload }) => Effect.succeed([Resource.upsert(payload.data)]),
  }),
});

const route = Webhook.route({
  path: "/webhooks/example",
  ackMode: "after-publish",
  schema: ProviderWebhookSchema,
  handler: ({ request, rawBody, payload, to }) =>
    Effect.gen(function* () {
      yield* verifySignature({ request, rawBody });
      yield* to(Posts, payload);
      return HttpServerResponse.jsonUnsafe({ ok: true });
    }),
});
```

Route behavior:

- reads the raw body once
- parses JSON once
- validates the route payload schema
- passes `request`, `rawBody`, typed `payload`, and `to(...)` to the handler
- returns `400` for invalid body reads, invalid JSON, or invalid route payloads
- returns `500` for unexpected handler/runtime/publisher failures

Signature verification is connector-owned and should use `rawBody`.

`ackMode: "after-publish"` publishes collected mutations before the response is completed. `ackMode: "after-enqueue"` enqueues collected mutations and lets the background webhook consumer publish them.

## Connector Definition

```ts
const connector = Connector.define({
  name: "producer-example",
  title: "Producer Example",
  resources: [Posts],
  webhooks: [route],
});
```

## Ingestion

`Ingestion.run(...)` contains the runtime engine. `ConnectorApp.start(...)` is the usual entrypoint for runnable producer CLIs.

Current runtime behavior:

- runs resource backfill, changes, and webhooks concurrently
- initializes the same initial cutoff for backfill and changes
- publishes through `Publisher.Publisher`
- checkpoints only after an accepted publish ACK
- does not checkpoint rejected publishes
- allows empty accepted batches to advance state
- stores `lastSuccessAt` with each durable checkpoint
- persists resource state through `StateStore.StateStore`
- parks a source when an expected failure reaches the ingestion engine, after any dependency retries
- keeps other sources, webhooks, and HTTP routes running when one source is parked

Parked sources resume after process restart or configuration redeployment. Defects and interruption are not isolated and still stop the runtime.

`Ingestion.run` depends only on the typed Airfoil `StateStore`; it does not expose the underlying Effect `KeyValueStore`. Provide `StateStore.layerMemory` for development/tests. Production entrypoints provide `StateStore.layerSql()`, which privately composes Effect's `KeyValueStore.layerSql` and scopes every key with the non-empty `AIRFOIL_CONNECTOR_INSTANCE_ID`. The platform ID is opaque and is not required to be a UUID.

State keys use plain colon-delimited segments and are intentionally inspectable; they are not escaped or encoded. The trusted backend must issue connector instance IDs without `:`, and connector authors must keep resource names free of `:`. Connector Kit currently relies on that naming contract rather than adding runtime validation.

The shared SQL table defaults to `_airfoil_connectors_state`. Set `AIRFOIL_STATE_TABLE` only to override that default. `POSTGRES_CONNECTION_STRING` is consumed by the PostgreSQL client layer, not by `StateStore` itself:

```ts
import { PgClient } from "@effect/sql-pg";
import { RuntimeConfig, StateStore } from "@useairfoil/connector-kit";
import { Config, Layer, Schema } from "effect";

const PostgresLive = PgClient.layerConfig({
  url: Config.schema(
    Schema.Redacted(Schema.NonEmptyString),
    RuntimeConfig.PlatformRuntimeKey.postgresConnectionString,
  ),
  maxConnections: Config.succeed(2),
});

const StateStoreLive = StateStore.layerSql().pipe(Layer.provide(PostgresLive));
```

The platform injects the instance ID and Secret-backed PostgreSQL connection string used by `PgClient`, plus an optional table-name override. Connector business code receives `StateStore` but does not receive the connector instance ID, raw SQL client, or global clear/size operations.

## Publisher

`Publisher.Publisher` is the Effect service boundary for publishing resource mutation batches.

`Publisher.layerConsole` accepts batches and logs them locally.

`Publisher.layerWings(...)` publishes mutations to Wings tables:

```ts
const publisherLayer = Publisher.layerWings({
  connector,
  tables: {
    posts: "namespaces/default/tables/posts",
  },
});
```

The `tables` map is keyed by resource name. Values can be table names or objects with a table name and optional partition value.

```ts
Publisher.layerWings({
  connector,
  tables: {
    posts: {
      name: "namespaces/default/tables/posts",
      partitionValue: "account_123",
    },
  },
});
```

The Wings publisher resolves table metadata during layer construction, validates resource key/version/partition compatibility, sends upserts with full rows, and sends deletes with key/version-only rows.

## Minimal Example

```ts
import { NodeRuntime } from "@effect/platform-node";
import {
  Connector,
  ConnectorApp,
  Cursor,
  Fetch,
  Publisher,
  Resource,
  StateStore,
  Telemetry,
} from "@useairfoil/connector-kit";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const PostSchema = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  updatedAt: Schema.String,
});

type Post = Schema.Schema.Type<typeof PostSchema>;

const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
  check: Effect.void,
  backfill: Fetch.page({
    pageCursor: Cursor.number(),
    cutoff: Cursor.isoDateTime(),
    fetch: () =>
      Effect.succeed({
        mutations: [
          Resource.upsert({ id: 1, title: "Hello", updatedAt: "2026-01-01T00:00:00.000Z" }),
        ],
        nextPageCursor: 1,
        hasMore: false,
      }),
  }),
});

const connector = Connector.define({
  name: "producer-example",
  resources: [Posts],
});

const BootstrapLayer = FetchHttpClient.layer;

const TelemetryLayer = Telemetry.layerOtlp().pipe(Layer.provide(BootstrapLayer));
const RuntimeLayer = Layer.mergeAll(
  BootstrapLayer,
  StateStore.layerMemory,
  Publisher.layerConsole,
  TelemetryLayer,
);

Effect.scoped(ConnectorApp.start(connector, { port: 8080 })).pipe(
  Effect.provide(RuntimeLayer),
  NodeRuntime.runMain,
);
```

## Telemetry

`Telemetry` contains connector-kit span names, span attributes, error annotation helpers, OTLP tracing layers, and OTLP metrics layers. HTTP connector runtimes expose shallow process health at `GET /health`, Prometheus metrics at `GET /metrics`, and durable sync state at `GET /status` by default. Provider, Wings, and PostgreSQL failures do not make `/health` fail.

`/status` includes `lastSuccessAt` for each checkpointed backfill or changes source. Use `time() - airfoil_connector_last_success_timestamp_seconds` to monitor source freshness without interpreting provider cursors.

Common entry points:

- `Telemetry.layer(config, options?)`
- `Telemetry.layerConfig(config, options?)`
- `Telemetry.layerOtlpTracing(options?)` for OTLP traces
- `Telemetry.layerOtlpMetrics(options?)` for OTLP metrics
- `Telemetry.layerOtlp(options?)` for both traces and metrics
- `Telemetry.layerMetricsConsoleDump(interval?)`

Default redacted headers:

- `authorization`
- `cookie`
- `set-cookie`
- `x-api-key`
- `/api[-_]?key/i`
- `/secret/i`
- `/signature/i`
- `/token/i`

Telemetry environment variables:

| Variable                      | Read by       | Description                                                                                                                                            |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OTEL_ENABLED`                | Connector Kit | Enables OTLP export when `true`. Defaults to `false`.                                                                                                  |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Connector Kit | OTLP base URL, for example `http://localhost:4318`. Connector Kit appends `/v1/traces` and `/v1/metrics` as needed. Required when `OTEL_ENABLED=true`. |
| `OTEL_EXPORTER_OTLP_HEADERS`  | Connector Kit | Optional comma-separated headers, for example `Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>`.                                                |
| `OTEL_SERVICE_NAME`           | Effect        | Service name resource attribute, for example `producer-shopify`.                                                                                       |
| `OTEL_SERVICE_VERSION`        | Effect        | Optional service version resource attribute.                                                                                                           |
| `OTEL_RESOURCE_ATTRIBUTES`    | Effect        | Optional comma-separated resource attributes, for example `deployment.environment=production,team=data`.                                               |

## Testing

For tests, the most common setup is:

- `StateStore.layerMemory` for state
- a small in-memory `Publisher.Publisher` test layer
- `ConnectorApp.check(...)` with an in-memory `ConfigProvider` for pre-provision validation
- `Ingestion.run(...)` or `ConnectorApp.start(...)` inside `Effect.scoped`

Keep HTTP recording concerns outside connector logic by providing a VCR-backed `HttpClient` Layer.
