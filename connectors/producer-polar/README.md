# @useairfoil/producer-polar

Polar producer connector for Airfoil Connector Kit.

Current scope:

- entities: `customers`, `checkouts`, `orders`, `subscriptions`
- backfill source: Polar REST API
- live source: Polar webhooks on `/webhooks/polar`

## Public Exports

- root: `PolarApiClient`, `PolarConnector`, entity schemas, webhook schema, and schema-derived types

Typical imports:

```ts
import { CustomerSchema, PolarConnector, type Customer } from "@useairfoil/producer-polar";
import { PolarApiClient, WebhookPayloadSchema } from "@useairfoil/producer-polar";
```

Connector config and runtime types are exported from the `PolarConnector` namespace.

## ConnectorApp Shape

`PolarConnector` is a `Context.Service` that resolves to:

```ts
type PolarConnectorRuntime = ConnectorApp.App<Webhook.Route<typeof WebhookPayloadSchema>>;
```

Use `PolarConnector.layerConfig(PolarConnector.PolarConfigConfig)` to build that service from Effect Config. For local sandbox runs, compose `PolarConnector.PolarConfigFields` with `Config.unwrap(...)` in the entrypoint and override `apiBaseUrl` with `Config.succeed("https://sandbox-api.polar.sh/v1/")`.

## Configuration

Required:

```env
POLAR_ACCESS_TOKEN=polar_oat_xxx
```

Production `start` also requires an explicit Polar API base URL:

```env
POLAR_API_BASE_URL=https://api.polar.sh/v1/
```

The `sandbox` command injects `https://sandbox-api.polar.sh/v1/` and does not read `POLAR_API_BASE_URL`.

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

Production `start` also requires Wings and table mapping config:

```env
WINGS_HOST=localhost:7777
WINGS_NAMESPACE=namespaces/default
POLAR_CUSTOMERS_TABLE=namespaces/default/tables/polar-customers
POLAR_CHECKOUTS_TABLE=namespaces/default/tables/polar-checkouts
POLAR_ORDERS_TABLE=namespaces/default/tables/polar-orders
POLAR_SUBSCRIPTIONS_TABLE=namespaces/default/tables/polar-subscriptions
```

The sandbox uses `Telemetry.layerOtlpTracing()` from Connector Kit. Connector Kit reads `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_EXPORTER_OTLP_HEADERS` for trace export. Effect reads `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, and `OTEL_RESOURCE_ATTRIBUTES` for resource metadata. The sandbox exports traces only; metrics and logs stay local.

## ConnectorApp Entrypoint

The package scripts run the connector CLI from source:

```bash
pnpm --filter @useairfoil/producer-polar run sandbox
pnpm --filter @useairfoil/producer-polar run start
```

`sandbox` runs the real connector against Polar sandbox with `Publisher.layerConsole`. `start` runs against the configured `POLAR_API_BASE_URL` and passes the configured Wings table names to `Publisher.layerWings`.

The CLI assembly lives in `src/main.ts`; production runtime wiring lives in `src/start.ts`; sandbox runtime wiring lives in `src/sandbox.ts`.

## Minimal ConnectorApp Wiring

```ts
import { Publisher, ConnectorApp, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { PolarConnector } from "@useairfoil/producer-polar";

const envLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const connectorLayer = PolarConnector.layerConfig(PolarConnector.PolarConfigConfig).pipe(
  Layer.provide(envLayer),
);

const telemetryLayer = Telemetry.layerOtlpTracing().pipe(Layer.provide(envLayer));

const program = Effect.gen(function* () {
  const entrypoint = yield* PolarConnector.PolarConnector;
  return yield* ConnectorApp.start(entrypoint, { port: 8080 });
});

const runtimeLayer = Layer.mergeAll(
  StateStore.layerMemory,
  Publisher.layerConsole,
  connectorLayer,
  telemetryLayer,
);

const runnable = Effect.scoped(program).pipe(Effect.provide(runtimeLayer));

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
import { Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { PolarApiClient } from "@useairfoil/producer-polar";

const apiLayer = PolarApiClient.layer({
  accessToken: "test",
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

Set `OTEL_ENABLED=true` to export traces from the sandbox. Metrics and logs stay local.

The sandbox uses `Telemetry.layerOtlpTracing()` with the default Connector Kit sensitive-header redaction. See `@useairfoil/connector-kit` for the full telemetry env var list and redaction defaults.

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
