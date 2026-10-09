# Polar producer

## Current scope

- Resources: `customers`, `checkouts`, `orders`, `subscriptions`, `refunds`,
  `products`, and `discounts`
- Backfill: Polar REST API
- Webhooks: `POST /webhooks/polar`

## Polar rules

- Pagination uses `page` and `limit`. The maximum limit is 100.
- Use `Retry-After` for `429`.
- Send `Polar-Version: POLAR_API_VERSION` on every request. Polar releases a
  version every quarter and removes it about nine months later.
- Webhook endpoints choose their own API version. Only accept
  `POLAR_API_VERSION`.
- Verify the Standard Webhooks headers against the raw body.

Use `modified_at ?? created_at` for backfill versions. Use the verified event
time for webhook versions.

Emit `customer.deleted` and `discount.deleted` as `_deleted: true`. Customer
rows derive `_deleted` from `deleted_at`. Discount rows leave it out, because a
deleted discount can't come back. Unknown
event types return `200` without writing a row. A handled event with a bad
payload still fails.

Subscriptions use `-started_at` because the endpoint cannot sort by
`created_at`. Keep the cutoff on `created_at`.

Product prices keep scalar amounts as columns. Tier data is stored as JSON in
`tiers` and `seat_tiers`.

Record VCR against the sandbox. Remove checkout secrets and customer details
from the cassette.

When adding a resource, check its read scope, pagination, webhook events,
version field, and delete behavior. Add a read-only config check. Cover
backfill and webhooks when both are supported.

Do not loosen a schema only to pass a fixture.

To upgrade the API version, compare the old and new OpenAPI specs at
`https://polar.sh/docs/openapi/<version>.openapi.json` for the resources and
events we use. Update `POLAR_API_VERSION` and the README. Then re-record the VCR
cassette against the sandbox.

Check the [Polar API changelog](https://polar.sh/docs/changelog/api) before
changing schemas or event handling.
