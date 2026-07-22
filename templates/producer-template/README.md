# @useairfoil/producer-template

Reference producer connector built on Airfoil Connector Kit.

It uses JSONPlaceholder so the package stays runnable, typecheckable, and testable without external credentials.

## Public Exports

- `TemplateApiClient`
- `TemplateConnector`
- `Post`
- `PostEvent`
- `PostEventSchema`
- `PostSchema`
- `WebhookPayload`
- `WebhookPayloadSchema`
- manifest subpath: `@useairfoil/producer-template/manifest` exports browser-safe connector metadata

Connector config and runtime types are exported from the `TemplateConnector` namespace.

## What This Package Shows

- a single-resource connector wired with `Connector.define` and `Resource.entity`
- an Effect `HttpClient` API client layer
- paginated backfill plus resource-owned webhook mutation handling
- `Webhook.route(...)` with schema-validated payloads
- a `main.ts` CLI with `sandbox` and `start` subcommands
- a production Dockerfile that compiles and runs the CLI as a non-root user
- a sandbox runtime using in-memory state and `Publisher.layerConsole`
- VCR-backed API tests and in-memory webhook tests

## Configuration

The sandbox reads connector values from the environment. Hosted `start` requires a read-only JSON file selected by `AIRFOIL_CONFIG_PATH`; matching environment values override file values per key.

```env
TEMPLATE_API_BASE_URL=https://jsonplaceholder.typicode.com
# Optional; JSONPlaceholder does not require auth.
# TEMPLATE_API_TOKEN=anonymous
TEMPLATE_WEBHOOK_SECRET=
TEMPLATE_WEBHOOK_PORT=8080
OTEL_ENABLED=false
OTEL_SERVICE_NAME=producer-template
# OTEL_SERVICE_VERSION=0.1.0
# OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,team=data
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>
```

Production `start` also requires platform-owned Wings, table, and PostgreSQL state config:

```env
WINGS_HOST=localhost:7777
WINGS_NAMESPACE=namespaces/default
TEMPLATE_POSTS_TABLE=namespaces/default/tables/template-posts
AIRFOIL_CONFIG_PATH=/var/run/airfoil/config/config.json
AIRFOIL_CONNECTOR_INSTANCE_ID=team-acme-template-primary
# AIRFOIL_STATE_TABLE=_airfoil_connectors_state
POSTGRES_CONNECTION_STRING=postgresql://...
```

The mounted `config.json` contains only manifest runtime keys, for example `{"TEMPLATE_API_BASE_URL":"https://jsonplaceholder.typicode.com"}`. Platform-owned values above are not written into that file.

The sandbox uses `Telemetry.layerOtlp()` and `Telemetry.layerMetricsConsoleDump()` from Connector Kit. Connector Kit reads `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_EXPORTER_OTLP_HEADERS` for OTLP trace/metric export. Effect reads `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, and `OTEL_RESOURCE_ATTRIBUTES` for resource metadata. HTTP runtimes expose `GET /health`, `GET /metrics`, and `GET /status` by default.

## ConnectorApp Entrypoint

This connector exposes a single CLI entrypoint in `src/main.ts`:

```bash
pnpm --filter @useairfoil/producer-template run sandbox
pnpm --filter @useairfoil/producer-template run start
```

`sandbox` runs the real connector with `Publisher.layerConsole`. `start` passes the configured Wings table name to `Publisher.layerWings`.

The CLI assembly lives in `src/main.ts`; connector-specific platform keys live in `src/constants.ts`; production runtime wiring lives in `src/start.ts`; sandbox runtime wiring lives in `src/sandbox.ts`.

Before provisioning, the dashboard backend passes `TemplateConnector.TemplateConnector` and `TemplateConnector.layerConfig(TemplateConnector.TemplateConfigDef.config)` to `ConnectorApp.check(...)`. The template demonstrates a read-only one-item request for each selected resource; replace it with the smallest provider request that proves the configured credentials can access that entity.

## Production Image

New connectors inherit a compiled `dist/main.js` CLI and a non-root Node 24 image. Rename the package and image identifiers when copying the template, then build and smoke-test it through Nx:

```bash
pnpm nx run @useairfoil/producer-template:docker:build
docker run --rm airfoil/producer-template:local --help
```

The image runs `node dist/main.js start`, exposes port `8080`, and contains only the pruned production package. Mount the connector JSON file read-only and inject platform-owned values separately. Never bake `.env` files or secrets into the image. The operator owns Kubernetes readiness and liveness probes against `/health`.

## Minimal ConnectorApp Wiring

The following is local/example wiring. Hosted production uses `RuntimeConfig.layerHosted()`, `StateStore.layerSql()` over `PgClient`, and the Wings publisher as shown by `src/start.ts`; it must not fall back to memory state.

```ts
import { Publisher, ConnectorApp, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { TemplateConnector } from "@useairfoil/producer-template";

const BootstrapLayer = FetchHttpClient.layer;

const ConnectorLayer = TemplateConnector.layerConfig(
  TemplateConnector.TemplateConfigDef.config,
).pipe(Layer.provide(BootstrapLayer));
const TelemetryLayer = Telemetry.layerOtlp().pipe(Layer.provide(BootstrapLayer));

const program = Effect.gen(function* () {
  const connector = yield* TemplateConnector.TemplateConnector;
  return yield* ConnectorApp.start(connector, { port: 8080 });
});

const RuntimeLayer = Layer.mergeAll(
  StateStore.layerMemory,
  Publisher.layerConsole,
  ConnectorLayer,
  TelemetryLayer,
);

const runnable = Effect.scoped(program).pipe(Effect.provide(RuntimeLayer));

Effect.runPromise(runnable);
```

## API Client Layer

`TemplateApiClient.layer(config)` builds `TemplateApiClient.TemplateApiClient` from a raw `TemplateConfig` value.

The default implementation uses bearer-token style auth and JSONPlaceholder pagination via `_page` and `_limit`.

```ts
import { Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { PostSchema, TemplateApiClient } from "@useairfoil/producer-template";

const apiLayer = TemplateApiClient.layer({
  apiBaseUrl: "https://jsonplaceholder.typicode.com",
  apiToken: Option.none(),
  webhookSecret: Option.none(),
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = TemplateApiClient.TemplateApiClient.use((api) =>
  api.fetchList(PostSchema, "/posts", {
    page: 1,
    limit: 10,
  }),
).pipe(Effect.provide(apiLayer));

Effect.runPromise(program);
```

## Webhook Behavior

- webhook path: `POST /webhooks/template`
- route payloads are decoded with `WebhookPayloadSchema`
- if `TEMPLATE_WEBHOOK_SECRET` is set, the connector requires the raw request body and passes it to the signature verification hook
- the included signature hook is intentionally a no-op because JSONPlaceholder has no webhooks; replace it and require the provider secret before exposing a copied connector publicly
- the template verification function currently accepts everything; replace it with real upstream verification when adapting this package

## Sandbox Tracing

Set `OTEL_ENABLED=true` to export traces and metrics from the sandbox. Metrics are also logged locally by `Telemetry.layerMetricsConsoleDump()`.

The sandbox uses `Telemetry.layerOtlp()` with the default Connector Kit sensitive-header redaction. Add provider-specific `redactedHeaders` when adapting the template if the upstream API uses custom secret headers.

For local Jaeger with persistent storage, start it from the traceview package:

```bash
pnpm --filter @useairfoil/traceview run jaeger:up
```

Then set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` and run the sandbox. After triggering a webhook or backfill, render the trace:

```bash
traceview <trace-id> --source jaeger
# or for Axiom:
traceview <trace-id> --source axiom
```

## Structure

```text
src/
├── api.ts
├── connector.ts
├── constants.ts
├── index.ts
├── main.ts
├── manifest.ts
├── sandbox.ts
├── schemas.ts
└── start.ts

test/
├── api.vcr.test.ts
├── helpers.ts
└── webhook.test.ts
```

## Testing

- `test/api.vcr.test.ts`: VCR-backed replay of the API client path
- `test/webhook.test.ts`: in-memory webhook flow using `NodeHttpServer.layerTest`

Run:

```bash
pnpm --filter @useairfoil/producer-template run test:ci
```
