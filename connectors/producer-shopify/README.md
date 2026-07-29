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
- `Money`
- `MoneyBag`
- `MoneyBagSchema`
- `MoneySchema`
- `PageInfo`
- `PageInfoSchema`
- `Product`
- `ProductDeleteWebhookPayload`
- `ProductDeleteWebhookPayloadSchema`
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
SHOPIFY_CLIENT_ID=your-dev-dashboard-app-client-id
SHOPIFY_CLIENT_SECRET=your-dev-dashboard-app-client-secret
SHOPIFY_WEBHOOK_SECRET=your-webhook-signing-value
```

Hosted `start` requires a read-only connector JSON file selected by `AIRFOIL_CONFIG_PATH`; matching environment values override file values per key. The file includes manifest runtime keys such as `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_API_VERSION`, and `SHOPIFY_WEBHOOK_SECRET`.

`SHOPIFY_WEBHOOK_SECRET` is the signing value Shopify shows when the merchant creates a webhook under Shopify Admin → Settings → Notifications → Webhooks. It is separate from `SHOPIFY_CLIENT_SECRET`.

Common sandbox/runtime values:

```env
SHOPIFY_API_VERSION=2026-07
# SHOPIFY_RESPONSE_MAX_RETRIES=5
# SHOPIFY_TRANSPORT_MAX_RETRIES=5
# SHOPIFY_GRAPHQL_MAX_RETRIES=5
# SHOPIFY_RETRY_BASE_DELAY_MS=200
# SHOPIFY_GRAPHQL_RETRY_BASE_DELAY_MS=500
# SHOPIFY_RETRY_AFTER_FALLBACK_SECONDS=1
# SHOPIFY_REQUEST_TIMEOUT_SECONDS=120
SHOPIFY_WEBHOOK_PORT=8080
OTEL_ENABLED=false
OTEL_SERVICE_NAME=producer-shopify
# OTEL_SERVICE_VERSION=0.1.0
# OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,team=data
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>
```

These optional API policy values are loaded with the connector config. Shopify's reported query cost, available budget, restore rate, and `Retry-After` remain authoritative.

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

The current product backfill requires `read_products`. Add more Admin API scopes to the app when more resources are enabled.

### Getting Shopify credentials

The merchant follows Shopify's [client-credentials setup](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens?lang=node): create a Dev Dashboard app in the same Shopify organization as the store, enable the required Admin API scopes, install it on the store, and give Airfoil:

- the store's `*.myshopify.com` domain
- the app client ID
- the app client secret

The connector exchanges those credentials at `/admin/oauth/access_token`. Shopify access tokens normally last 24 hours. The connector keeps the token only in memory and lazily exchanges again after half of the reported lifetime. Pod restarts simply exchange on the first API request. Do not store access tokens in `StateStore` or commit either credential.

Store webhooks remain manual. The merchant creates each required topic in Shopify Admin, points it to the connector's public `/webhooks/shopify` URL, and provides the generated signing value as `SHOPIFY_WEBHOOK_SECRET`.

## ConnectorApp Entrypoint

This connector exposes a single CLI entrypoint in `src/main.ts`:

```bash
pnpm --filter @useairfoil/producer-shopify run sandbox
pnpm --filter @useairfoil/producer-shopify run start
```

`sandbox` runs the real connector with `Publisher.layerConsole`. `start` passes the configured Wings table names to `Publisher.layerWings`.

The CLI assembly lives in `src/main.ts`; connector-specific platform keys live in `src/constants.ts`; production runtime wiring lives in `src/start.ts`; sandbox runtime wiring lives in `src/sandbox.ts`.

Before provisioning, the dashboard backend passes `ShopifyConnector.ShopifyConnector` and `ShopifyConnector.layerConfig(ShopifyConnector.ShopifyConfigDef.config)` to `ConnectorApp.check(...)`. `products` requests one product ID only, while webhook-only `cart_events` uses a minimal shop identity query that does not require product access.

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
- expected topic headers include `products/create`, `products/update`, `products/delete`, `carts/create`, and `carts/update`
- `SHOPIFY_WEBHOOK_SECRET` is required and every request verifies `x-shopify-hmac-sha256` against the raw request body
- `products/create` and `products/update` publish directly when the webhook contains every variant and its creation time
- Shopify only includes full details for the first 100 variants; when `variant_gids` shows truncation, or `created_at` is missing, the handler refetches the complete product over GraphQL before publishing
- product rows expose nested variants as `variants`; backfill and webhook upserts keep this list complete
- signed `products/delete` webhooks convert Shopify's numeric product ID to a GraphQL product GID and publish a delete mutation using `X-Shopify-Triggered-At` as the version
- product webhook decoding is strict for the fields required to normalize product rows; if you use Shopify `include_fields`, include the product fields required by `ProductWebhookPayloadSchema`
- cart webhooks are normalized into the `cart_events` event stream using the documented cart payload fields
- product upserts are versioned by `updatedAt`; product deletes use `X-Shopify-Triggered-At`

## API Client Layer

`ShopifyApiClient.layer(config)` builds `ShopifyApiClient.ShopifyApiClient` from a raw `ShopifyConfig` value.

The client:

- lazily exchanges the configured client credentials for an access token
- caches the token in memory until half its reported lifetime
- authenticates GraphQL calls with `X-Shopify-Access-Token`
- posts GraphQL operations to `/admin/api/<version>/graphql.json`
- sends `Accept: application/json` and `Content-Type: application/json`
- follows product and nested variant pagination through `pageInfo.endCursor`

Use `ShopifyConnector.layer(...)` or `ShopifyConnector.layerConfig(...)` for complete runtime wiring. `ShopifyApiClient.layer(...)` is the lower-level connector-internal layer and also requires `ShopifyAuth`.

## Notes

- the connector uses Shopify Admin GraphQL
- the API version is pinned through `SHOPIFY_API_VERSION`
- product backfill paginates both products and their nested variants
- product row output is GraphQL-native camelCase; Shopify webhook payloads are normalized before publishing

## Testing

- `test/api.vcr.test.ts`: VCR product response and mocked nested-variant pagination
- `test/auth.test.ts`: client-credentials exchange, safe errors, and request authentication
- `test/check.test.ts`: selected read-only resource checks
- `test/webhook.test.ts`: in-memory webhook flow with HMAC verification

Run:

```bash
pnpm --filter @useairfoil/producer-shopify run test:ci
```

To record the API cassette, put real Shopify values in the connector `.env` and run:

```bash
pnpm --filter @useairfoil/producer-shopify exec dotenvx run \
  --ignore=MISSING_ENV_FILE \
  --quiet \
  -- vitest run test/api.vcr.test.ts
```

The VCR's auto mode records requests missing from the cassette. Do not set `ACK_DISABLE_VCR`, because that bypasses recording. Token request credentials and response access tokens are replaced with fixed placeholders automatically. Shopify cookies and GraphQL `X-Shopify-Access-Token` headers are removed before the cassette is written.

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
