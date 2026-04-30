# @useairfoil/producer-polar

Polar producer connector for Airfoil Connector Kit.

Current scope:

- entities: `customers`, `checkouts`, `orders`, `subscriptions`
- backfill source: Polar REST API
- live source: Polar webhooks on `/webhooks/polar`

## Public Exports

- `PolarApiClient`
- `layerApiClient(config)`
- `PolarConnector`
- `layerConfig`
- `PolarConfig`
- `PolarConfigConfig`
- `PolarConnectorRuntime`

## Runtime Shape

`PolarConnector` is a `Context.Service` that resolves to:

```ts
type PolarConnectorRuntime = {
  readonly connector: ConnectorDefinition;
  readonly routes: ReadonlyArray<Webhook.WebhookRoute<typeof WebhookPayloadSchema>>;
};
```

Use `layerConfig` to build that service from Effect Config.

## Configuration

Required:

```env
POLAR_ACCESS_TOKEN=polar_oat_xxx
```

Optional:

```env
POLAR_API_BASE_URL=https://sandbox-api.polar.sh/v1/
POLAR_ORGANIZATION_ID=org_xxx
POLAR_WEBHOOK_SECRET=polar_whs_xxx
POLAR_WEBHOOK_PORT=8080
ACK_TELEMETRY_ENABLED=false
ACK_OTLP_BASE_URL=http://localhost:4318
ACK_SERVICE_NAME=producer-polar
```

## Minimal Runtime Wiring

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { Ingestion, Publisher } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { createServer } from "node:http";

import { layerConfig, PolarConnector } from "@useairfoil/producer-polar";

const ConsolePublisher = Layer.succeed(Publisher.Publisher)({
  publish: ({ name, source, batch }) => Effect.succeed({ success: true }),
});

const envLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const connectorLayer = layerConfig.pipe(Layer.provide(envLayer));

const program = Effect.gen(function* () {
  const { connector, routes } = yield* PolarConnector;
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

## Webhook Behavior

- webhook path: `POST /webhooks/polar`
- route payloads are schema-validated through `Webhook.route(...)`
- when `POLAR_WEBHOOK_SECRET` is set, webhook signatures are verified against the raw request body
- the first live webhook event establishes the cutoff used to start backfill for each entity stream

## API Client Layer

`layerApiClient(config)` builds `PolarApiClient` from a raw `PolarConfig` value.

This is useful for focused API tests or custom runtimes that do not need the full connector service.

```ts
import { Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { layerApiClient, PolarApiClient } from "@useairfoil/producer-polar";

const apiLayer = layerApiClient({
  accessToken: "test",
  apiBaseUrl: "https://sandbox-api.polar.sh/v1/",
  organizationId: Option.none(),
  webhookSecret: Option.none(),
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = PolarApiClient.use((api) =>
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
- backfill de-duplicates rows already observed live
- incoming events outside the current connector scope are ignored

## Testing

- `test/api.vcr.test.ts`: VCR-backed API replay against a recorded cassette
- `test/webhook.test.ts`: in-memory webhook round-trip using `NodeHttpServer.layerTest`

Run:

```bash
pnpm --filter @useairfoil/producer-polar run test:ci
```
