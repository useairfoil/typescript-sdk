# @useairfoil/producer-polar

Polar producer connector for Airfoil Connector Kit.

Current scope:

- entities: `customers`, `checkouts`, `orders`, `subscriptions`
- backfill source: Polar REST API
- live source: Polar webhooks on `/webhooks/polar`

## Public Exports

- root: `PolarApiClient`, `PolarConnector`, entity schemas, webhook schema, and schema-derived types
- manifest subpath: `@useairfoil/producer-polar/manifest` exports browser-safe connector metadata

Typical imports:

```ts
import { CustomerSchema, PolarConnector, type Customer } from "@useairfoil/producer-polar";
import { PolarApiClient, WebhookPayloadSchema } from "@useairfoil/producer-polar";
```

Connector config and runtime types are exported from the `PolarConnector` namespace.

## ConnectorApp Shape

`PolarConnector` is a typed Effect service with `layer(config)` and `layerConfig(config)`. Runtime and dashboard validation both use `layerConfig(PolarConfigDef.config)`. Local sandbox runs use `layerConfig(...)` with a `Config.succeed("https://sandbox-api.polar.sh/v1/")` override for `apiBaseUrl`.

## Configuration

The sandbox reads connector values from the environment:

```env
POLAR_ACCESS_TOKEN=polar_oat_xxx
```

The sandbox injects the Polar sandbox API URL. Hosted `start` instead requires a read-only connector JSON file selected by `AIRFOIL_CONFIG_PATH`; matching environment values override file values per key. The file includes manifest runtime keys such as `POLAR_ACCESS_TOKEN` and `POLAR_API_BASE_URL`.

```env
POLAR_API_BASE_URL=https://api.polar.sh/v1/
```

Optional:

```env
POLAR_ORGANIZATION_ID=org_xxx
POLAR_WEBHOOK_SECRET=polar_whs_xxx
POLAR_WEBHOOK_PORT=8080
OTEL_ENABLED=false
OTEL_SERVICE_NAME=producer-polar
# OTEL_SERVICE_VERSION=0.1.0
# OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,team=data
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer token,X-Axiom-Dataset=airfoil-traces
```

Production `start` also requires platform-owned Wings, table, and PostgreSQL state config:

```env
WINGS_HOST=localhost:7777
WINGS_NAMESPACE=namespaces/default
POLAR_CUSTOMERS_TABLE=namespaces/default/tables/polar-customers
POLAR_CHECKOUTS_TABLE=namespaces/default/tables/polar-checkouts
POLAR_ORDERS_TABLE=namespaces/default/tables/polar-orders
POLAR_SUBSCRIPTIONS_TABLE=namespaces/default/tables/polar-subscriptions
AIRFOIL_CONFIG_PATH=/var/run/airfoil/config/config.json
AIRFOIL_CONNECTOR_INSTANCE_ID=team-acme-polar-primary
# AIRFOIL_STATE_TABLE=_airfoil_connectors_state
POSTGRES_CONNECTION_STRING=postgresql://...
```

The sandbox uses `Telemetry.layerOtlp()` and `Telemetry.layerMetricsConsoleDump()` from Connector Kit. Connector Kit reads `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_EXPORTER_OTLP_HEADERS` for OTLP trace/metric export. Effect reads `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, and `OTEL_RESOURCE_ATTRIBUTES` for resource metadata. HTTP runtimes expose `GET /health`, `GET /metrics`, and `GET /status` by default.

## ConnectorApp Entrypoint

The package scripts run the connector CLI from source:

```bash
pnpm --filter @useairfoil/producer-polar run sandbox
pnpm --filter @useairfoil/producer-polar run start
```

`sandbox` runs the real connector against Polar sandbox with `Publisher.layerConsole`. `start` runs against the configured `POLAR_API_BASE_URL` and passes the configured Wings table names to `Publisher.layerWings`.

The CLI assembly lives in `src/main.ts`; connector-specific platform keys live in `src/constants.ts`; production runtime wiring lives in `src/start.ts`; sandbox runtime wiring lives in `src/sandbox.ts`.

Before provisioning, the dashboard backend passes `PolarConnector.PolarConnector` and `PolarConnector.layerConfig(PolarConnector.PolarConfigDef.config)` to `ConnectorApp.check(...)`. Each selected entity performs a read-only one-item request against its corresponding Polar list endpoint; unselected entities are not contacted.

## Production Image

The build emits a separate `dist/main.js` CLI while keeping it outside the package exports. Build and smoke-test the non-root Node 24 image through Nx:

```bash
pnpm nx run @useairfoil/producer-polar:docker:build
docker run --rm airfoil/producer-polar:local --help
```

The image runs `node dist/main.js start`, exposes port `8080`, and contains only the pruned production package. Mount the complete connector JSON file read-only at the path supplied by `AIRFOIL_CONFIG_PATH`; inject the platform-owned values listed above separately. Never bake `.env`, access tokens, webhook secrets, or database credentials into the image. The operator owns Kubernetes readiness and liveness probes against `/health`.

## Minimal ConnectorApp Wiring

The following is local/example wiring. Hosted production uses `RuntimeConfig.layerHosted()`, `StateStore.layerSql()` over `PgClient`, and the Wings publisher as shown by `src/start.ts`; it must not fall back to memory state.

```ts
import { Publisher, ConnectorApp, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { PolarConnector } from "@useairfoil/producer-polar";

const BootstrapLayer = FetchHttpClient.layer;

const ConnectorLayer = PolarConnector.layerConfig(PolarConnector.PolarConfigDef.config).pipe(
  Layer.provide(BootstrapLayer),
);
const TelemetryLayer = Telemetry.layerOtlp().pipe(Layer.provide(BootstrapLayer));

const program = Effect.gen(function* () {
  const connector = yield* PolarConnector.PolarConnector;
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

## Webhook Behavior

- webhook path: `POST /webhooks/polar`
- route payloads are schema-validated through `Webhook.route(...)`
- when `POLAR_WEBHOOK_SECRET` is set, webhook signatures are verified against the raw request body
- webhook payloads dispatch to resource-owned handlers that emit accepted mutations

## API Client Layer

`PolarApiClient.layer(config)` builds `PolarApiClient.PolarApiClient` from a raw `PolarConfig` value.

This is useful for focused API tests or custom runtimes that do not need the full connector service.

```ts
import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { PolarApiClient } from "@useairfoil/producer-polar";

const apiLayer = PolarApiClient.layer({
  accessToken: Redacted.make("test"),
  apiBaseUrl: "https://sandbox-api.polar.sh/v1/",
  organizationId: Option.none(),
  webhookSecret: Option.none(),
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = PolarApiClient.PolarApiClient.use((api) =>
  api.fetchList(Schema.Any, "customers/", {
    page: 1,
    limit: 100,
    sorting: "-created_at",
  }),
).pipe(Effect.provide(apiLayer));

Effect.runPromise(program);
```

## Development Notes

- Polar entity streams combine live webhook events with paginated backfill
- backfill is bounded by the cutoff established from live webhooks or the initial runtime cutoff
- incoming events outside the current connector scope are ignored

## Testing

- `test/api.vcr.test.ts`: VCR-backed API replay against a recorded cassette
- `test/webhook.test.ts`: in-memory webhook round-trip using `NodeHttpServer.layerTest`

Run:

```bash
pnpm --filter @useairfoil/producer-polar run test:ci
```

## Sandbox Tracing

Set `OTEL_ENABLED=true` to export traces and metrics from the sandbox. Metrics are also logged locally by `Telemetry.layerMetricsConsoleDump()`.

The sandbox uses `Telemetry.layerOtlp()` with the default Connector Kit sensitive-header redaction. See `@useairfoil/connector-kit` for the full telemetry env var list, metric names, and redaction defaults.

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

Webhook traces may include an external parent span from Polar's `traceparent` header — that parent is expected to be missing from your dataset unless Polar also exports there.
