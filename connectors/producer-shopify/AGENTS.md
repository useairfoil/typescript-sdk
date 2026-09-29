# Shopify producer

## Current scope

- Backfill resources: `products`, `customers`, `orders`, `refunds`
- Webhook-only resource: `carts`
- Backfill: Shopify Admin GraphQL
- Webhooks: `POST /webhooks/shopify`

## Shopify rules

- The API version is part of the GraphQL URL.
- Pagination uses `pageInfo.hasNextPage` and `endCursor`.
- Handle GraphQL errors even when HTTP succeeds.
- Respect `Retry-After` and Shopify throttle data.
- Verify `X-Shopify-Hmac-SHA256` against the raw body.

Keep nested variant pagination deterministic. Use provider timestamps for row
versions. Emit product, customer, and order deletes as `_af_deleted: true`,
versioned by `X-Shopify-Triggered-At`.

Map order and refund webhooks directly. Do not refetch: without
`read_all_orders`, a missing order may only be outside the 60-day window.
Map customer webhooks as partial updates. Missing fields stay missing, and an
unset text field uses an empty string. Tag events only need a small tags query.
The customer backfill keeps rows past the cutoff.
Normalize values shared by GraphQL and webhooks. Skip `shipping_refund` order
adjustments, which GraphQL shows as refund shipping lines.

Refunds use `processedAt` for row versions.

When adding a resource, check its Admin API scope, GraphQL cost, pagination,
webhook topics, version field, and delete behavior. Add a read-only config
check. Cover backfill and webhooks when both are supported.

Check the [Shopify changelog](https://shopify.dev/changelog) before changing the
API version or schemas.
