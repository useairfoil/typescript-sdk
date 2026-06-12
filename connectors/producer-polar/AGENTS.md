# Polar Agent Notes

Use this file before editing the Polar producer. It combines provider-wide facts
for future upgrades with the current connector implementation map.

Research retrieval date for provider facts: 2026-05-15.

## Source Of Truth

- API overview: https://docs.polar.sh/api-reference/introduction
- API reference root: https://docs.polar.sh/api-reference
- API changelog: https://docs.polar.sh/changelog/api
- Product changelog: https://docs.polar.sh/changelog/recent
- Auth docs: https://docs.polar.sh/integrate/authentication
- Organization access tokens: https://docs.polar.sh/integrate/oat
- Pagination docs: https://docs.polar.sh/api-reference/introduction#pagination
- Sandbox docs: https://docs.polar.sh/integrate/sandbox
- Webhook endpoints: https://docs.polar.sh/integrate/webhooks/endpoints
- Webhook delivery and verification: https://docs.polar.sh/integrate/webhooks/delivery
- Webhook event catalog: https://docs.polar.sh/integrate/webhooks/events
- Production dashboard: `https://polar.sh/dashboard/${org_slug}/settings`
- Sandbox dashboard: `https://sandbox.polar.sh/dashboard/${org_slug}/settings`

## API Versioning

- Polar uses path versioning under `/v1`.
- Production base URL: `https://api.polar.sh/v1`.
- Sandbox base URL: `https://sandbox-api.polar.sh/v1`.
- No formal deprecation/support-window policy was found in official docs. Treat
  the API changelog as the source of breaking and behavioral changes.
- There is no documented per-request version header. Version selection is the URL
  path and environment base URL.

## Auth And Scopes

- Core API auth uses `Authorization: Bearer <token>` and `Accept:
application/json`.
- Server-to-server integrations use Organization Access Tokens (OATs), commonly
  prefixed `polar_oat_`.
- OATs are created in the organization dashboard with explicit scopes and an
  expiration date.
- Sandbox tokens are separate from production tokens and are not interchangeable.
- Common read scopes for future entity coverage:
  - products: `products:read`
  - customers: `customers:read`
  - orders: `orders:read`
  - subscriptions: `subscriptions:read`
  - checkouts: `checkouts:read`; mutations need `checkouts:write`
  - meters and metrics: `meters:read`, `metrics:read`
- Webhook receiving has no OAT scope. Webhooks are authenticated by the per-endpoint
  signing secret.
- Do not print or commit OATs, customer tokens, webhook secrets, or VCR material
  containing them.

## Pagination And Rate Limits

- List endpoints use `page` and `limit` query parameters.
- Defaults: `page=1`, `limit=10`.
- Maximum documented `limit` is 100.
- Responses include a `pagination` object with `total_count` and `max_page`.
- Request the next page while `page < pagination.max_page`.
- Rate limits are documented as 500 requests/minute in production and 100
  requests/minute in sandbox per organization/customer/OAuth client.
- On `429`, Polar returns `Retry-After`. Prefer honoring it instead of tight
  retries.

## Webhooks

- Endpoint URL must be publicly reachable HTTPS with no redirects. Polar treats
  3xx as failures.
- Delivery timeout is 10 seconds; Polar recommends responding in under 2 seconds.
- Endpoints are auto-disabled after 10 consecutive non-2xx failures.
- Delivery is at least once with exponential-backoff retries. Dedupe on
  `webhook-id`.
- Polar uses the Standard Webhooks signature scheme.
- Required headers are `webhook-id`, `webhook-timestamp`, and
  `webhook-signature`.
- Signature format is `v1,<base64-hmac>`, possibly with multiple space-separated
  signatures.
- The signed payload is `{webhook-id}.{webhook-timestamp}.{raw-body}` using
  HMAC-SHA256.
- Official docs call out that the secret must be base64-encoded for the HMAC key.
  Do not hand-roll verification; use `@polar-sh/sdk/webhooks` or a Standard
  Webhooks library.
- Custom outbound webhook headers are not supported. Configure URL, secret,
  format, and event selection in the dashboard.

## Platform Resource Map

This lists Polar capabilities for future upgrades. See
`Current Connector Implementation` for what is currently deployed.

- Products: REST `/v1/products/`; webhooks `product.created`, `product.updated`;
  scopes `products:read` and `products:write` for mutations.
- Customers: REST `/v1/customers/...`; webhooks `customer.created`,
  `customer.updated`, `customer.deleted`, `customer.state_changed`; scopes
  `customers:read` and `customers:write`.
- Orders: REST `/v1/orders/...`; webhooks `order.created`, `order.paid`,
  `order.updated`, `order.refunded`; scope `orders:read`.
- Subscriptions: REST `/v1/subscriptions/...`; webhooks `subscription.created`,
  `subscription.active`, `subscription.updated`, `subscription.canceled`,
  `subscription.uncanceled`, `subscription.past_due`, `subscription.revoked`;
  scope `subscriptions:read`.
- Checkouts: REST `/v1/checkouts/...`; webhooks `checkout.created`,
  `checkout.updated`, `checkout.expired`; scopes `checkouts:read` and
  `checkouts:write`.
- Additional useful future surfaces: refunds, benefits, benefit grants, meters,
  metrics, files, and webhook management endpoints.

## Current Connector Implementation

- Package: `@useairfoil/producer-polar`.
- Backfill source: Polar REST API.
- Production `start` requires `POLAR_API_BASE_URL`; sandbox injects
  `https://sandbox-api.polar.sh/v1/`.
- Auth env: `POLAR_ACCESS_TOKEN`; request header `Authorization: Bearer <token>`.
- Optional organization filter: `POLAR_ORGANIZATION_ID`.
- Webhook path: `/webhooks/polar`.
- Webhook secret env: `POLAR_WEBHOOK_SECRET`.
- Current entities: `customers`, `checkouts`, `orders`, `subscriptions`.
- Current resource model combines resource webhook mutations with paginated backfill.
- Sandbox telemetry uses `Telemetry.layerOtlpTracing()` with Connector Kit default
  sensitive-header redaction.

## Known Drift Risks

- Polar has no formal published API version policy beyond `/v1`; monitor the API
  changelog before schema changes or connector upgrades.
- `order.status` now includes `pending`; do not assume `order.created` means paid
  or terminal.
- There is no `subscription.renewed` event. Renewals surface as `order.created`
  with `billing_reason="subscription_cycle"`.
- `subscription.canceled` can still have `status="active"` with
  `cancel_at_period_end=true`; `subscription.revoked` means access ended.
- Common enum drift points include `billing_reason`, `subscription.status`,
  `customer_cancellation_reason`, `product.recurring_interval`, and price
  `amount_type`.
- Common nullable or free-form fields include `external_id`, trial dates,
  cancellation/end timestamps, `discount_id`, `checkout_id`, address/tax
  objects, and `metadata`.
- Sandbox/prod confusion produces immediate auth or data-shape surprises because
  base URLs, tokens, and webhook endpoints are separate.
- Strict tests can hit sandbox rate limits if replay is accidentally disabled.
- `@polar-sh/sdk` version bumps can change webhook verification behavior or
  TypeScript exports independently of raw API changes. After a dependency update,
  check the SDK changelog and run webhook signature verification tests before
  assuming the Polar API changed.
- If the first live webhook event crashes the handler before backfill starts, the
  backfill cutoff may be written but backfill will stall. Recovery requires
  fixing the handler, re-enabling the Polar endpoint in the dashboard, and
  verifying stored cutoff state.

## Changelog Items To Watch

- `order.status="pending"`, `order.updated`, `order.paid`, and `Order.paid`.
- Usage-based billing schema changes on Order and Subscription resources.
- Webhook management endpoints added to the API reference and SDK.
- Rate limits and restricted rate-limit groups.
- Scheduled subscription change fields and webhooks.
- Seat-based checkout fields such as `min_seats` and `max_seats`.
- New benefit types such as Feature Flag benefits.

## Repo Code Map

- Schemas: `src/schemas.ts`
- API client: `src/api.ts`
- Resource fetches, connector definition, and webhook route: `src/connector.ts`
- CLI entrypoint: `src/main.ts`
- Production CLI runtime and Wings publishing: `src/start.ts`
- Sandbox CLI runtime and Polar sandbox API override: `src/sandbox.ts`
- VCR API replay: `test/api.vcr.test.ts`
- Webhook fixture flow: `test/webhook.test.ts`
- Test helpers: `test/helpers.ts`
- VCR cassettes: `test/__cassettes__/`

## Verification Commands

- `pnpm --filter @useairfoil/producer-polar run typecheck`
- `pnpm --filter @useairfoil/producer-polar run test:ci`
- `pnpm --filter @useairfoil/producer-polar run build`
- `pnpm run format`
- `pnpm run lint`

## Safety Rules

- Do not hand-edit VCR cassettes.
- Do not print or commit `.env`, OATs, customer tokens, webhook secrets, or HMAC
  inputs.
- Do not replace strict resource schemas with `Schema.Any` except for documented
  free-form fields such as metadata.
- Do not add new entity coverage without checking scopes, event names, pagination,
  rate limits, and deterministic replay coverage.
- Do not upgrade `@polar-sh/sdk` without reading its changelog and rerunning
  `test/webhook.test.ts` with signature verification enabled.
