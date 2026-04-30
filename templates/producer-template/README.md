# @useairfoil/producer-template

Reference producer connector built on Airfoil Connector Kit.

It uses JSONPlaceholder so the package stays runnable, typecheckable, and testable without external credentials.

## Public Exports

- `TemplateApiClient`
- `layerApiClient(config)`
- `TemplateConnector`
- `layerConfig`
- `TemplateConfig`
- `TemplateConfigConfig`
- `TemplateConnectorRuntime`
- `Post`
- `PostSchema`
- `WebhookPayload`
- `WebhookPayloadSchema`

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
ACK_TELEMETRY_ENABLED=false
ACK_OTLP_BASE_URL=http://localhost:4318
ACK_SERVICE_NAME=producer-template
```

## Minimal Runtime Wiring

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { Ingestion, Publisher } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { createServer } from "node:http";

import { layerConfig, TemplateConnector } from "@useairfoil/producer-template";

const ConsolePublisher = Layer.succeed(Publisher.Publisher)({
  publish: () => Effect.succeed({ success: true }),
});

const envLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const connectorLayer = layerConfig.pipe(Layer.provide(envLayer));

const program = Effect.gen(function* () {
  const { connector, routes } = yield* TemplateConnector;
  const serverLayer = NodeHttpServer.layer(createServer, { port: 8080 });

  return yield* Ingestion.runConnector(connector, {
    initialCutoff: new Date(),
    webhook: {
      routes,
      healthPath: "/health",
      disableHttpLogger: true,
    },
  }).pipe(Effect.provide(serverLayer));
});

const runtimeLayer = Layer.mergeAll(Ingestion.layerMemory, ConsolePublisher, connectorLayer);

const runnable = Effect.scoped(program).pipe(Effect.provide(runtimeLayer));

Effect.runPromise(runnable);
```

## API Client Layer

`layerApiClient(config)` builds `TemplateApiClient` from a raw `TemplateConfig` value.

The default implementation uses bearer-token style auth and JSONPlaceholder pagination via `_page` and `_limit`.

```ts
import { Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { layerApiClient, PostSchema, TemplateApiClient } from "@useairfoil/producer-template";

const apiLayer = layerApiClient({
  apiBaseUrl: "https://jsonplaceholder.typicode.com",
  apiToken: "anonymous",
  webhookSecret: Option.none(),
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = TemplateApiClient.use((api) =>
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
- if `TEMPLATE_WEBHOOK_SECRET` is set, the connector expects a raw body and passes it to the signature verification hook
- the template verification function currently accepts everything; replace it with real upstream verification when adapting this package

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
