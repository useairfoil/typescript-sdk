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
- `ConnectorApp.start(...)` starts a complete Node HTTP connector process.

The package is intentionally Layer-oriented: connector code defines resources and routes, while entrypoints provide runtime dependencies such as publishers, state stores, telemetry, and API clients.

## Install

```bash
pnpm add @useairfoil/connector-kit effect@^4.0.0-beta.83
```

This repo currently uses Effect v4 beta. In workspace packages, prefer the workspace catalog (`"effect": "catalog:"`) so all packages stay on the pinned beta version.

## Package Shape

The package root exposes the common connector authoring API:

```ts
import {
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
  StateStore,
  Status,
  Telemetry,
  Webhook,
} from "@useairfoil/connector-kit";
```

Subpath exports are available for runtime domains:

- `@useairfoil/connector-kit/ingestion`
- `@useairfoil/connector-kit/connector-app`
- `@useairfoil/connector-kit/manifest`
- `@useairfoil/connector-kit/metrics`
- `@useairfoil/connector-kit/publisher`
- `@useairfoil/connector-kit/state-store`
- `@useairfoil/connector-kit/status`
- `@useairfoil/connector-kit/webhook`
- `@useairfoil/connector-kit/errors`

Core definition helpers and `Telemetry` are intentionally root-only.

## Manifests

Connector manifests are pure metadata for UI, Wings deployment, and validation. Put user-facing connector config in `src/manifest.ts` and keep platform-owned runtime config, such as ports, Wings host, table names, and OTEL flags, as normal Effect `Config` in entrypoints.

```ts
import * as Manifest from "@useairfoil/connector-kit/manifest";

export const ExampleConfigDef = Manifest.defineConfig({
  apiBaseUrl: Manifest.string({
    env: "EXAMPLE_API_BASE_URL",
    required: false,
    default: "https://api.example.test",
  }),
  apiToken: Manifest.secret({ env: "EXAMPLE_API_TOKEN" }),
  webhookSecret: Manifest.optional(Manifest.secret({ env: "EXAMPLE_WEBHOOK_SECRET" })),
});

export type ExampleConfig = Manifest.ConfigValuesOf<typeof ExampleConfigDef>;

export const manifest = Manifest.define({
  name: "producer-example",
  title: "Example",
  config: ExampleConfigDef.spec,
  resources: [{ name: "posts", capabilities: ["backfill", "webhook"] }],
});
```

`ExampleConfigDef.config` is the runtime Effect config. `ExampleConfigDef.spec` is serializable manifest metadata. `required` defaults to `true` and is independent from `default`; set `required: false` or wrap with `Manifest.optional(...)` for optional form/schema fields.

Use `Manifest.configSchema(manifest)` for backend/form validation and `Schema.toStandardSchemaV1(...)` for standard-schema form resolvers. The schema accepts normal JSON values and browser form-shaped values: number fields may arrive as strings, boolean fields may arrive as booleans or `"true"`/`"false"`, optional fields may be omitted or submitted as `""`, and required strings reject `""`.

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

Render fields from `manifest.config`: use `field.name` as the form/storage key, `field.description` for help text, `field.secret` for password inputs/redaction, `field.values` for selects, `field.default` for initial values, and `field.required` for required markers. Wings should store submitted config by manifest field `name`, then map stored values to required `field.env` names when deploying producer pods. Platform-owned runtime config such as Wings host, namespace, table names, ports, and OTEL settings stays outside the manifest as normal infrastructure-provided environment config.

## Resource Model

Resources emit mutations, not raw rows. Connector Kit currently supports `Resource.entity(...)` for Wings table-backed resources.

```ts
const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
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
- persists resource state through `StateStore.StateStore`

Provide a `KeyValueStore.layerMemory` (from `effect/unstable/persistence`) for development and tests, or your own durable `KeyValueStore` implementation — `Ingestion.run` builds the typed `StateStore` on top of it automatically.

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
  Telemetry,
} from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { KeyValueStore } from "effect/unstable/persistence";

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

const EnvLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const TelemetryLayer = Telemetry.layerOtlp().pipe(Layer.provide(EnvLayer));
const runtimeLayer = Layer.mergeAll(
  KeyValueStore.layerMemory,
  Publisher.layerConsole,
  TelemetryLayer,
);

Effect.scoped(ConnectorApp.start(connector, { port: 8080 })).pipe(
  Effect.provide(runtimeLayer),
  NodeRuntime.runMain,
);
```

## Telemetry

`Telemetry` contains connector-kit span names, span attributes, error annotation helpers, OTLP tracing layers, and OTLP metrics layers. HTTP connector runtimes expose Prometheus metrics at `GET /metrics` and sync state at `GET /status` by default.

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

- `KeyValueStore.layerMemory` (from `effect/unstable/persistence`) for state
- a small in-memory `Publisher.Publisher` test layer
- `Ingestion.run(...)` or `ConnectorApp.start(...)` inside `Effect.scoped`

Keep HTTP recording concerns outside connector logic by providing a VCR-backed `HttpClient` Layer.
