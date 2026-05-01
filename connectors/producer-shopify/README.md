# producer-shopify

Shopify producer connector for Airfoil Connector Kit (ACK).

Current v1 scope:

- Entity: `products`
- Backfill source: Shopify Admin REST `GET /products.json`
- Live source: Shopify webhooks on `products/create` and `products/update`

## Architecture

- `src/api.ts`: REST client with `X-Shopify-Access-Token` auth and Link-header pagination support
- `src/streams.ts`: cutoff-aware backfill stream plus live webhook queue
- `src/connector.ts`: connector/entity registration and webhook route/signature verification
- `src/sandbox.ts`: runnable local runtime (Node server + in-memory store + console publisher)

## Environment variables

Copy `.env.example` to `.env` and fill values:

- `SHOPIFY_API_BASE_URL` - full base URL including pinned API version, for example `https://your-store.myshopify.com/admin/api/2026-01`
- `SHOPIFY_API_TOKEN` - Admin API access token (`X-Shopify-Access-Token`)
- `SHOPIFY_WEBHOOK_SECRET` - app shared secret used to validate `X-Shopify-Hmac-SHA256`
- `SHOPIFY_WEBHOOK_PORT` - local webhook server port (default `8080`)

Recommended scope for this v1 connector: `read_products`.

## Usage

Run sandbox:

```bash
pnpm --filter @useairfoil/producer-shopify run sandbox
```

Webhook endpoint:

- `POST /webhooks/shopify`

Expected headers:

- `X-Shopify-Topic` (`products/create` or `products/update`)
- `X-Shopify-Hmac-SHA256` (verified against raw body bytes)

## Tests

- `test/api.vcr.test.ts`: deterministic replay of a recorded `products.json` response
- `test/webhook.test.ts`: in-memory webhook flow with HMAC signature verification

### VCR workflow

1. Ensure `.env` contains valid `SHOPIFY_API_BASE_URL` and `SHOPIFY_API_TOKEN`.
2. Record cassette:

```bash
rm -rf connectors/producer-shopify/test/__cassettes__
pnpm --filter @useairfoil/producer-shopify run test:ci -- test/api.vcr.test.ts
```

3. Replay-only verification:

```bash
pnpm --filter @useairfoil/producer-shopify run test:ci
```

Run tests:

```bash
pnpm --filter @useairfoil/producer-shopify run test:ci
```

## Notes

- Shopify REST Admin API is legacy; GraphQL is recommended by Shopify for new apps.
- This connector pins REST paths by embedding the version in `SHOPIFY_API_BASE_URL`.
- Pagination follows Shopify Link header `rel="next"` URLs with `page_info` cursors.
- Inbound webhook signature validation uses `SHOPIFY_WEBHOOK_SECRET` and raw body HMAC SHA-256.
