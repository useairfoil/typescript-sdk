# Shopify producer

## Current scope

- Backfill resource: `products`
- Webhook-only resource: `cart_events`
- Backfill: Shopify Admin GraphQL
- Webhooks: `POST /webhooks/shopify`

## Shopify rules

- The API version is part of the GraphQL URL.
- Product access needs `read_products`.
- Pagination uses `pageInfo.hasNextPage` and `endCursor`.
- Handle GraphQL errors even when HTTP succeeds.
- Respect `Retry-After` and Shopify throttle data.
- Verify `X-Shopify-Hmac-SHA256` against the raw body.
- The webhook secret is not the app client secret.

Keep nested variant pagination deterministic. Use provider timestamps for row
versions.

When adding a resource, check its Admin API scope, GraphQL cost, pagination,
webhook topics, version field, and delete behavior. Add a read-only config
check. Cover backfill and webhooks when both are supported.

Check the [Shopify changelog](https://shopify.dev/changelog) before changing the
API version or schemas.
