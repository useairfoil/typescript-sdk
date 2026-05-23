# Shopify Agent Notes

Use this file before editing the Shopify producer. It combines provider-wide
facts for future upgrades with the current connector implementation map.

Research retrieval date for provider facts: 2026-05-15.

## Source Of Truth

- API index: https://shopify.dev/docs/api
- GraphQL Admin API: https://shopify.dev/docs/api/admin-graphql
- REST Admin API, legacy as of 2024-10-01: https://shopify.dev/docs/api/admin-rest
- Changelog: https://shopify.dev/changelog
- API versioning: https://shopify.dev/docs/api/usage/versioning
- Auth overview: https://shopify.dev/docs/apps/build/authentication-authorization
- Admin access scopes: https://shopify.dev/docs/api/usage/access-scopes
- Custom app access tokens: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin
- REST pagination: https://shopify.dev/docs/api/usage/pagination-rest
- Webhook overview: https://shopify.dev/docs/apps/build/webhooks
- Webhook HTTPS delivery and HMAC: https://shopify.dev/docs/apps/build/webhooks/subscribe/https
- Webhook topic catalog: https://shopify.dev/docs/api/webhooks
- Development stores: https://shopify.dev/docs/apps/build/dev-dashboard/stores

## API Versioning

- Prefer GraphQL Admin API for new work. REST Admin API is legacy.
- Current stable version from this research is `2026-04`; release candidate is
  `2026-07`.
- Version selection is in the URL path, for example
  `/admin/api/2026-04/graphql.json`.
- Shopify releases a new stable version quarterly. Stable versions are supported
  for at least 12 months with at least 9 months of overlap.
- Unsupported requested versions fall forward to the oldest supported stable
  version. Confirm served version with `X-Shopify-API-Version` on API responses
  and webhook deliveries.
- OAuth endpoints are unversioned. Webhook payloads are versioned by the
  subscription configuration.

## Auth And Scopes

- Admin API requests use `X-Shopify-Access-Token: <token>`.
- Do not print or commit access tokens, client secrets, webhook secrets, or VCR
  material containing them.
- App auth is OAuth 2.0. Current connector usage can use an installed custom app
  Admin API token.
- New public apps created on or after 2026-04-01 must use expiring offline access
  tokens; designs that assume non-expiring public-app tokens need refresh or
  reinstall handling.
- Common read scopes for future entity coverage:
  - products: `read_products`
  - customers: `read_customers`; protected customer data approval may be required
  - orders: `read_orders`; `read_all_orders` is gated and needed beyond the
    normal order history window
  - checkouts: `read_checkouts`
  - subscription contracts: `read_own_subscription_contracts`; payment-method
    workflows may need `read_customer_payment_methods`
- Webhook verification does not have a dedicated scope. Mandatory compliance
  webhooks may be required for App Store apps.

## Pagination

- GraphQL Admin API uses Relay-style connections with `pageInfo` and cursors.
  Request the next page with `after: pageInfo.endCursor` when
  `pageInfo.hasNextPage` is true.
- REST Admin API uses cursor pagination through the HTTP `Link` header. REST
  `limit` defaults to 50 and maxes at 250. Follow the `rel="next"` URL; do not
  invent `page` parameters.
- GraphQL connection limits and query costs are field-specific. Check the field
  reference before raising page sizes.

## Webhooks

- HTTPS endpoint must have valid TLS, avoid redirects, and return 2xx quickly.
  Shopify documents a 1 second connection timeout and 5 second total request
  timeout.
- Shopify retries failed deliveries 8 times over roughly 4 hours. Admin-API
  subscriptions can be deleted after 8 consecutive failures.
- Verify `X-Shopify-Hmac-SHA256` as HMAC-SHA256 over the raw request body keyed by
  the app client secret, base64 encoded. Do not verify a parsed or reserialized
  body.
- Standard webhook headers include `X-Shopify-Topic`,
  `X-Shopify-Shop-Domain`, `X-Shopify-API-Version`, `X-Shopify-Webhook-Id`,
  `X-Shopify-Triggered-At`, and `X-Shopify-Event-Id`.
- Ordering is not guaranteed and duplicate deliveries are possible. Use
  `X-Shopify-Event-Id` for dedupe and timestamp/resource cursors for ordering.

## Platform Resource Map

This lists Shopify capabilities for future upgrades. See
`Current Connector Implementation` for what is currently deployed.

- Products: GraphQL `Query.products` and `Query.product(id:)`; REST
  `/products.json`; webhooks `products/create`, `products/update`,
  `products/delete`; scope `read_products`.
- Customers: GraphQL `Query.customers`; REST `/customers.json`; webhooks
  `customers/create`, `customers/update`, `customers/delete`; mandatory privacy
  topics may include `customers/data_request`, `customers/redact`, and
  `shop/redact`; scope `read_customers` plus protected-data approval as needed.
- Orders: GraphQL `Query.orders`; REST `/orders.json`; webhooks include
  `orders/create`, `orders/updated`, `orders/cancelled`, `orders/fulfilled`,
  `orders/paid`, `orders/edited`, and `orders/delete`; scopes `read_orders` and
  gated `read_all_orders` for older history.
- Subscription contracts: GraphQL `subscriptionContracts` and
  `SubscriptionContract`; webhooks `subscription_contracts/create`,
  `subscription_contracts/update`, and subscription billing-attempt topics;
  protected scopes apply.
- Checkouts: GraphQL checkout and abandoned-checkout surfaces; webhooks
  `checkouts/create`, `checkouts/update`, `checkouts/delete`; scope
  `read_checkouts`.

## Current Connector Implementation

- Package: `@useairfoil/producer-shopify`.
- Backfill entity: `products` from Admin GraphQL.
- Event stream: `cart_events` from cart webhooks.
- Default API version: `2026-04` via `SHOPIFY_API_VERSION`.
- API endpoint shape: `https://<shop>/admin/api/<version>/graphql.json`.
- Auth env: `SHOPIFY_API_TOKEN`; request header `X-Shopify-Access-Token`.
- Current recommended scopes: `read_products`, `read_orders`.
- Product query shape: `products(first:, after:, sortKey: UPDATED_AT, reverse: true)`.
- Webhook path: `/webhooks/shopify`.
- Current topics: `products/create`, `products/update`, `carts/create`,
  `carts/update`.
- Product webhooks are REST-shaped and normalized to the GraphQL-native product
  row shape before publishing.
- Product rows expose variants as `variantsFirstPage` and `variantsPageInfo`.
- Sandbox telemetry uses `Telemetry.layerOtlpTracing({ redactedHeaders:
["x-shopify-access-token"] })`.

## Known Drift Risks

- Quarterly GraphQL schema changes can add enum values, nullable fields, or remove
  deprecated fields. Check the changelog before widening schemas.
- Unsupported version fall-forward can change served response shape without a
  config change. Compare `SHOPIFY_API_VERSION` with `X-Shopify-API-Version`.
- REST payloads and REST webhooks can differ from GraphQL node shapes; keep
  explicit normalizers rather than sharing schemas by accident.
- Product status and inventory/variant enums are common strict-decoder breakage
  points.
- Customer and order data may require protected-data approval. Auth failures can
  be scope/approval problems, not schema problems.
- Body parsers that consume or mutate the raw body before HMAC verification cause
  false signature failures.
- Webhook payloads follow the subscription API version and may drift separately
  from the backfill API version.
- Bumping `SHOPIFY_API_VERSION` does not automatically update the API version used
  by existing webhook subscriptions. Re-register webhook subscriptions with the
  new version in Shopify or the connector can keep receiving old-version payloads.
- Cassettes and sandbox request logs capture `X-Shopify-API-Version` on each
  response. Compare it against `SHOPIFY_API_VERSION` before investigating schema
  drift; a mismatch means version fall-forward is in effect.

## Changelog Items To Watch

- Expiring offline access tokens required for new public apps as of 2026-04-01:
  https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-public-apps-april-1-2026
- REST order `pre_tax_price` removal:
  https://shopify.dev/changelog/removal-of-pretaxprice-from-the-order-rest-admin-api
- Subscription contract `paymentMethodId` optional in 2026-04:
  https://shopify.dev/changelog/create-subscriptions-contracts-without-payment-methods
- 2026-07 enum and field removals such as `CollectionSortOrder.MOST_RELEVANT`,
  `MetaobjectAdminAccess` removals, and `DraftOrderLineItem.grams` removal.

## Repo Code Map

- Schemas and normalizers: `src/schemas.ts`
- API client: `src/api.ts`
- Streams and cursors: `src/streams.ts`
- Connector definition and webhook route: `src/connector.ts`
- CLI entrypoint: `src/main.ts`
- Production CLI runtime and Wings publishing: `src/start.ts`
- Sandbox CLI runtime and telemetry redaction: `src/sandbox.ts`
- VCR API replay: `test/api.vcr.test.ts`
- Webhook fixture flow: `test/webhook.test.ts`
- Test helpers: `test/helpers.ts`
- VCR cassettes: `test/__cassettes__/`

## Verification Commands

- `pnpm --filter @useairfoil/producer-shopify run typecheck`
- `pnpm --filter @useairfoil/producer-shopify run test:ci`
- `pnpm --filter @useairfoil/producer-shopify run build`
- `pnpm run format`
- `pnpm run lint`

## Safety Rules

- Do not hand-edit VCR cassettes.
- Do not print or commit `.env`, Shopify tokens, client secrets, webhook secrets,
  or HMAC inputs.
- Do not replace strict schemas with `Schema.Any` unless Shopify documents a
  field as intentionally free-form.
- Do not add new resource coverage without checking scopes, protected-data
  requirements, webhook topics, and deterministic replay coverage.
- Do not bump `SHOPIFY_API_VERSION` without re-registering webhook subscriptions
  with the new version in Shopify or webhook payloads will continue at the old
  version.
