# @useairfoil/producer-shopify

Shopify producer connector for Airfoil Connector Kit.

Current scope:

- entity: `products`
- event: `cart_events`
- backfill source: Shopify Admin GraphQL `products` query
- live source: Shopify webhooks on `/webhooks/shopify`

## Public Exports

- `ShopifyApiClient`
- `ShopifyConnector`
- `CartEvent`
- `CartEventSchema`
- `CartLineItem`
- `CartLineItemSchema`
- `CartWebhookPayload`
- `CartWebhookPayloadSchema`
- `MoneyBagSchema`
- `MoneySchema`
- `Product`
- `ProductOption`
- `ProductOptionSchema`
- `ProductWebhookPayload`
- `ProductWebhookPayloadSchema`
- `ProductSchema`
- `ProductStatus`
- `ProductStatusSchema`
- `ProductVariant`
- `ProductVariantInventoryPolicy`
- `ProductVariantInventoryPolicySchema`
- `ProductVariantSchema`
- `ShopifyNormalize`
- `WebhookPayload`
- `WebhookPayloadSchema`
- manifest subpath: `@useairfoil/producer-shopify/manifest` exports browser-safe connector metadata

Connector config and runtime types are exported from the `ShopifyConnector` namespace.

## Configuration

The sandbox reads connector values from the environment:

```env
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_API_TOKEN=shpat_xxx
```

Hosted `start` requires a read-only connector JSON file selected by `AIRFOIL_CONFIG_PATH`; matching environment values override file values per key. The file includes manifest runtime keys such as `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_API_TOKEN`, `SHOPIFY_API_VERSION`, and `SHOPIFY_WEBHOOK_SECRET`.

Common sandbox/runtime values:

```env
SHOPIFY_API_VERSION=2026-04
SHOPIFY_WEBHOOK_SECRET=your-app-shared-secret
SHOPIFY_WEBHOOK_PORT=8080
OTEL_ENABLED=false
OTEL_SERVICE_NAME=producer-shopify
# OTEL_SERVICE_VERSION=0.1.0
# OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,team=data
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>
```

Production `start` also requires platform-owned Wings, table, and PostgreSQL state config:

```env
WINGS_HOST=localhost:7777
WINGS_NAMESPACE=namespaces/default
SHOPIFY_PRODUCTS_TABLE=namespaces/default/tables/shopify-products
SHOPIFY_CART_EVENTS_TABLE=namespaces/default/tables/shopify-cart-events
AIRFOIL_CONFIG_PATH=/var/run/airfoil/config/config.json
AIRFOIL_CONNECTOR_INSTANCE_ID=team-acme-shopify-primary
# AIRFOIL_STATE_TABLE=_airfoil_connectors_state
POSTGRES_CONNECTION_STRING=postgresql://...
```

The sandbox uses `Telemetry.layerOtlp(...)` and `Telemetry.layerMetricsConsoleDump()` from Connector Kit. Connector Kit reads `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_EXPORTER_OTLP_HEADERS` for OTLP trace/metric export. Effect reads `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, and `OTEL_RESOURCE_ATTRIBUTES` for resource metadata. HTTP runtimes expose `GET /health`, `GET /metrics`, and `GET /status` by default.

Recommended Shopify scopes for the current connector surface: `read_products` and `read_orders`.

### Getting `SHOPIFY_API_TOKEN`

Create and install a Shopify custom app on the store with the required Admin API scopes. Use the custom app's client ID and client secret to request an Admin API access token:

```bash
curl -X POST "https://<store>.myshopify.com/admin/oauth/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=client_credentials&client_id=<custom-app-client-id>&client_secret=<custom-app-client-secret>"
```

Use the returned access token as `SHOPIFY_API_TOKEN`. Do not commit the client secret or access token.

## ConnectorApp Entrypoint

This connector exposes a single CLI entrypoint in `src/main.ts`:

```bash
pnpm --filter @useairfoil/producer-shopify run sandbox
pnpm --filter @useairfoil/producer-shopify run start
```

`sandbox` runs the real connector with `Publisher.layerConsole`. `start` passes the configured Wings table names to `Publisher.layerWings`.

The CLI assembly lives in `src/main.ts`; connector-specific platform keys live in `src/constants.ts`; production runtime wiring lives in `src/start.ts`; sandbox runtime wiring lives in `src/sandbox.ts`.

Before provisioning, the dashboard backend passes `ShopifyConnector.ShopifyConnector` and `ShopifyConnector.layerConfig(ShopifyConnector.ShopifyConfigDef.config)` to `ConnectorApp.check(...)`. `products` performs a one-item products query, while webhook-only `cart_events` uses a minimal shop identity query that does not require product access.

## Production Image

The build emits a separate `dist/main.js` CLI while keeping it outside the package exports. Build and smoke-test the non-root Node 24 image through Nx:

```bash
pnpm nx run @useairfoil/producer-shopify:docker:build
docker run --rm airfoil/producer-shopify:local --help
```

The image runs `node dist/main.js start`, exposes port `8080`, and contains only the pruned production package. Mount the complete connector JSON file read-only at the path supplied by `AIRFOIL_CONFIG_PATH`; inject the platform-owned values listed above separately. Never bake `.env`, API tokens, webhook secrets, or database credentials into the image. The operator owns Kubernetes readiness and liveness probes against `/health`.

## Minimal ConnectorApp Wiring

The following is local/example wiring. Hosted production uses `RuntimeConfig.layerHosted()`, `StateStore.layerSql()` over `PgClient`, and the Wings publisher as shown by `src/start.ts`; it must not fall back to memory state.

```ts
import { Publisher, ConnectorApp, StateStore, Telemetry } from "@useairfoil/connector-kit";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { ShopifyConnector } from "@useairfoil/producer-shopify";

const BootstrapLayer = FetchHttpClient.layer;

const ConnectorLayer = ShopifyConnector.layerConfig(ShopifyConnector.ShopifyConfigDef.config).pipe(
  Layer.provide(BootstrapLayer),
);
const TelemetryLayer = Telemetry.layerOtlp({
  redactedHeaders: ["x-shopify-access-token"],
}).pipe(Layer.provide(BootstrapLayer));

const program = Effect.gen(function* () {
  const connector = yield* ShopifyConnector.ShopifyConnector;
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

- webhook path: `POST /webhooks/shopify`
- expected topic headers include `products/create`, `products/update`, `carts/create`, and `carts/update`
- when `SHOPIFY_WEBHOOK_SECRET` is set, the connector verifies `x-shopify-hmac-sha256` against the raw request body
- live product webhook payloads are normalized into the GraphQL-native product shape used by backfill
- product rows expose nested variants as `variantsFirstPage` plus `variantsPageInfo`; backfill rows contain the first GraphQL variants page, while webhook rows contain the REST-delivered variants with `variantsPageInfo.hasNextPage = false`
- product webhook decoding is strict for the fields required to normalize product rows; if you use Shopify `include_fields`, include the product fields required by `ProductWebhookPayloadSchema`
- cart webhooks are normalized into the `cart_events` event stream using the documented cart payload fields
- live events are merged with backfill using the entity cursor field `updatedAt`

## API Client Layer

`ShopifyApiClient.layer(config)` builds `ShopifyApiClient.ShopifyApiClient` from a raw `ShopifyConfig` value.

The client:

- authenticates with `X-Shopify-Access-Token`
- posts GraphQL operations to `/admin/api/<version>/graphql.json`
- sends `Accept: application/json` and `Content-Type: application/json`
- follows Shopify GraphQL connection pagination through `pageInfo.endCursor`

```ts
import { Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { ShopifyApiClient } from "@useairfoil/producer-shopify";

const apiLayer = ShopifyApiClient.layer({
  shopDomain: "your-store.myshopify.com",
  apiVersion: "2026-04",
  apiToken: Redacted.make("test-token"),
  webhookSecret: Option.none(),
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = ShopifyApiClient.ShopifyApiClient.use((api) =>
  api.fetchProducts({ first: 50 }),
).pipe(Effect.provide(apiLayer));

Effect.runPromise(program);
```

## Notes

- the connector uses Shopify Admin GraphQL
- the API version is pinned through `SHOPIFY_API_VERSION`
- pagination follows GraphQL `pageInfo.endCursor`
- product row output is GraphQL-native camelCase; Shopify webhook payloads are normalized before publishing

## Testing

- `test/api.vcr.test.ts`: deterministic GraphQL product response tests
- `test/webhook.test.ts`: in-memory webhook flow with HMAC verification

Run:

```bash
pnpm --filter @useairfoil/producer-shopify run test:ci
```

## Sandbox Tracing

Set `OTEL_ENABLED=true` to export traces and metrics from the sandbox. Metrics are also logged locally by `Telemetry.layerMetricsConsoleDump()`.

The sandbox uses `Telemetry.layerOtlp({ redactedHeaders: ["x-shopify-access-token"] })` so Shopify access tokens are redacted in addition to Connector Kit defaults. See `@useairfoil/connector-kit` for the full telemetry env var list, metric names, and redaction defaults.

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
