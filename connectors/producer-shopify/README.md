# Shopify producer

This connector backfills Shopify products, customers, orders, and refunds. It
gets product, cart, customer, order, and refund events at
`POST /webhooks/shopify`.

## Config

| Variable                               | Required | Default   |
| -------------------------------------- | -------- | --------- |
| `SHOPIFY_SHOP_DOMAIN`                  | yes      | none      |
| `SHOPIFY_CLIENT_ID`                    | yes      | none      |
| `SHOPIFY_CLIENT_SECRET`                | yes      | none      |
| `SHOPIFY_WEBHOOK_SECRET`               | yes      | none      |
| `SHOPIFY_API_VERSION`                  | no       | `2026-07` |
| `SHOPIFY_RESPONSE_MAX_RETRIES`         | no       | `5`       |
| `SHOPIFY_TRANSPORT_MAX_RETRIES`        | no       | `5`       |
| `SHOPIFY_GRAPHQL_MAX_RETRIES`          | no       | `5`       |
| `SHOPIFY_RETRY_BASE_DELAY_MS`          | no       | `200`     |
| `SHOPIFY_GRAPHQL_RETRY_BASE_DELAY_MS`  | no       | `500`     |
| `SHOPIFY_RETRY_AFTER_FALLBACK_SECONDS` | no       | `1`       |
| `SHOPIFY_REQUEST_TIMEOUT_SECONDS`      | no       | `120`     |

Use a Shopify app owned by the merchant. The app needs `read_products`,
`read_customers`, and `read_orders`. Without `read_all_orders`, Shopify returns
only the last 60 days of orders and their refunds. The webhook secret is not the
app client secret.

## Setup

Create a [Dev Dashboard app](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens?lang=node)
in the same Shopify organization as the store. Add the scopes above, install the
app, and use its client ID and client secret.

Request protected customer data access for name, email, phone, and address. The
config check fails without it.

Create these webhooks in Shopify Admin:

- `products/create`
- `products/update`
- `products/delete`
- `carts/create`
- `carts/update`
- `customers/create`
- `customers/disable`
- `customers/enable`
- `customers/update`
- `customers/delete`
- `customers/purchasing_summary`
- `customers_email_marketing_consent/update`
- `customers_marketing_consent/update`
- `customer.tags_added`
- `customer.tags_removed`
- `orders/create`
- `orders/updated`
- `orders/delete`
- `refunds/create`

Point them to `/webhooks/shopify` and use the webhook signing value as
`SHOPIFY_WEBHOOK_SECRET`. Pick the same webhook API version as
`SHOPIFY_API_VERSION`. The connector logs a warning when they differ.

## Data

- Customers, orders, and refunds hold protected customer data such as names,
  emails, phones, addresses, and notes. Treat these tables as customer data.
- `locale`, `productSubscriberStatus`, and `dataSaleOptOut` come from backfill
  only. Customers created later do not have them.
- Webhooks can't clear some values back to null yet, such as dates, enums,
  addresses, and product media. The old value stays.
- Current order totals include refunds.
- Order webhooks are mapped without refetching. If Shopify truncates line items
  on a very large order, the webhook row can miss lines.
- A refund row does not mean the payment completed. Check its transaction
  status.
- Refunds use `processedAt` for versions. A later settlement can be missed if
  Shopify keeps the same time.
- After backfill, updates depend on webhooks. Missed webhook deliveries are not
  recovered yet.

## Local development

```bash
cd connectors/producer-shopify
pnpm sandbox
```

A hosted run loads connector config from `AIRFOIL_CONFIG_PATH`. It also needs
the Wings and PostgreSQL variables from the Connector Kit README.

```bash
cd connectors/producer-shopify
pnpm start
```
