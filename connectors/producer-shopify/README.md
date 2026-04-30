# @useairfoil/producer-shopify

Shopify producer connector for Airfoil Connector Kit.

Current scope:

- entity: `products`
- backfill source: Shopify Admin REST `GET /products.json`
- live source: Shopify webhooks on `/webhooks/shopify`

## Public Exports

- `ShopifyApiClient`
- `layerApiClient(config)`
- `ShopifyConnector`
- `layerConfig`
- `ShopifyConfig`
- `ShopifyConfigConfig`
- `ShopifyConnectorRuntime`
- `Product`
- `ProductSchema`
- `WebhookPayload`
- `WebhookPayloadSchema`

## Configuration

Required:

```env
SHOPIFY_API_TOKEN=shpat_xxx
```

Common:

```env
SHOPIFY_API_BASE_URL=https://your-store.myshopify.com/admin/api/2026-01
SHOPIFY_WEBHOOK_SECRET=your-app-shared-secret
SHOPIFY_WEBHOOK_PORT=8080
ACK_TELEMETRY_ENABLED=false
ACK_OTLP_BASE_URL=http://localhost:4318
ACK_SERVICE_NAME=producer-shopify
```

Recommended Shopify scope for the current connector surface: `read_products`.

## Minimal Runtime Wiring

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { Ingestion, Publisher } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { createServer } from "node:http";

import { layerConfig, ShopifyConnector } from "@useairfoil/producer-shopify";

const ConsolePublisher = Layer.succeed(Publisher.Publisher)({
  publish: () => Effect.succeed({ success: true }),
});

const envLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
);

const connectorLayer = layerConfig.pipe(Layer.provide(envLayer));

const program = Effect.gen(function* () {
  const { connector, routes } = yield* ShopifyConnector;
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

- webhook path: `POST /webhooks/shopify`
- expected topic headers include `products/create` and `products/update`
- when `SHOPIFY_WEBHOOK_SECRET` is set, the connector verifies `x-shopify-hmac-sha256` against the raw request body
- live events are merged with backfill using the entity cursor field `updated_at`

## API Client Layer

`layerApiClient(config)` builds `ShopifyApiClient` from a raw `ShopifyConfig` value.

The client:

- authenticates with `X-Shopify-Access-Token`
- sends `Accept: application/json`
- follows Shopify `Link` headers for `rel="next"` pagination

```ts
import { Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { layerApiClient, ProductSchema, ShopifyApiClient } from "@useairfoil/producer-shopify";

const apiLayer = layerApiClient({
  apiBaseUrl: "https://your-store.myshopify.com/admin/api/2026-01",
  apiToken: "test-token",
  webhookSecret: Option.none(),
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = ShopifyApiClient.use((api) =>
  api.fetchList(ProductSchema, "/products.json", {
    limit: 50,
  }),
).pipe(Effect.provide(apiLayer));

Effect.runPromise(program);
```

## Notes

- the current connector uses Shopify Admin REST
- the API version is pinned through `SHOPIFY_API_BASE_URL`
- pagination follows the full `nextUrl` returned by Shopify

## Testing

- `test/api.vcr.test.ts`: VCR replay of a recorded `products.json` response
- `test/webhook.test.ts`: in-memory webhook flow with HMAC verification

Run:

```bash
pnpm --filter @useairfoil/producer-shopify run test:ci
```
