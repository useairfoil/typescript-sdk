# @useairfoil/producer-template

Reference producer connector built on Airfoil Connector Kit.

It uses JSONPlaceholder so the package stays runnable, typecheckable, and testable without external credentials.

## Public Exports

- `TemplateApiClient`
- `TemplateConnector`
- `Post`
- `PostSchema`
- `WebhookPayload`
- `WebhookPayloadSchema`

Connector config and runtime types are exported from the `TemplateConnector` namespace.

## What This Package Shows

- a single-entity connector wired with `defineConnector` and `defineEntity`
- an Effect `HttpClient` API client layer
- paginated backfill plus queue-backed live webhook streams
- `Webhook.route(...)` with schema-validated payloads
- a sandbox runtime using Node HTTP, in-memory state, and a console publisher
- VCR-backed API tests and in-memory webhook tests

## Configuration

Defaults make the package runnable without extra setup, but all values still flow through Effect Config.

```env
TEMPLATE_API_BASE_URL=https://jsonplaceholder.typicode.com
TEMPLATE_API_TOKEN=anonymous
TEMPLATE_WEBHOOK_SECRET=
TEMPLATE_WEBHOOK_PORT=8080
OTEL_ENABLED=false
OTEL_SERVICE_NAME=producer-template
# OTEL_SERVICE_VERSION=0.1.0
# OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,team=data
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>
```

The sandbox uses `Telemetry.layerOtlpTracing()` from Connector Kit. Connector Kit reads `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_EXPORTER_OTLP_HEADERS` for trace export. Effect reads `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, and `OTEL_RESOURCE_ATTRIBUTES` for resource metadata. The sandbox exports traces only; metrics and logs stay local.

## Minimal Runtime Wiring

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { Ingestion, Publisher, Telemetry } from "@useairfoil/connector-kit";
import { ConfigProvider, DateTime, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { createServer } from "node:http";

import { TemplateConnector } from "@useairfoil/producer-template";

const ConsolePublisher = Layer.succeed(Publisher.Publisher)({
  publish: () => Effect.succeed({ success: true }),
});

const envLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const connectorLayer = TemplateConnector.layerConfig(TemplateConnector.TemplateConfigConfig).pipe(
  Layer.provide(envLayer),
);

const telemetryLayer = Telemetry.layerOtlpTracing().pipe(Layer.provide(envLayer));

const program = Effect.gen(function* () {
  const { connector, routes } = yield* TemplateConnector.TemplateConnector;
  const serverLayer = NodeHttpServer.layer(createServer, { port: 8080 });
  const now = yield* DateTime.now;

  return yield* Ingestion.runConnector(connector, {
    initialCutoff: now,
    webhook: {
      routes,
      healthPath: "/health",
      disableHttpLogger: true,
    },
  }).pipe(Effect.provide(serverLayer));
});

const runtimeLayer = Layer.mergeAll(
  Ingestion.layerMemory,
  ConsolePublisher,
  connectorLayer,
  telemetryLayer,
);

const runnable = Effect.scoped(program).pipe(Effect.provide(runtimeLayer));

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
  apiToken: "anonymous",
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
- the template verification function currently accepts everything; replace it with real upstream verification when adapting this package

## Sandbox Tracing

Set `OTEL_ENABLED=true` to export traces from the sandbox. Metrics and logs stay local.

The sandbox uses `Telemetry.layerOtlpTracing()` with the default Connector Kit sensitive-header redaction. Add provider-specific `redactedHeaders` when adapting the template if the upstream API uses custom secret headers.

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
├── schemas.ts
├── sandbox.ts
├── streams.ts
└── index.ts

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
