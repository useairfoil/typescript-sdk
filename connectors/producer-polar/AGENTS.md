# Polar producer

## Current scope

- Resources: `customers`, `checkouts`, `orders`, and `subscriptions`
- Backfill: Polar REST API
- Webhooks: `POST /webhooks/polar`

## Polar rules

- Production API: `https://api.polar.sh/v1`
- Sandbox API: `https://sandbox-api.polar.sh/v1`
- Auth: `Authorization: Bearer <token>`
- Pagination uses `page` and `limit`. The maximum limit is 100.
- Use `Retry-After` for `429`.
- Send `Polar-Version: POLAR_API_VERSION` on every request. Polar releases a
  version every quarter and removes it about nine months later.
- Webhook endpoints choose their own API version. Only accept
  `POLAR_API_VERSION`.
- Sandbox and production tokens are different.
- Verify the Standard Webhooks headers against the raw body.

Use `modified_at ?? created_at` for backfill versions. Use the verified event
time for webhook versions.

Emit `customer.deleted` as `_af_deleted: true`. Route pause and resume events
to `subscriptions`.

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
