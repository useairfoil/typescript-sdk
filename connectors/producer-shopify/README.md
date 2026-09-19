# Shopify producer

This connector backfills Shopify products. It gets product and cart events at
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

Use a Shopify app owned by the merchant. The app needs `read_products`. The
webhook secret is not the app client secret.

## Setup

Create a [Dev Dashboard app](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens?lang=node)
in the same Shopify organization as the store. Add `read_products`, install the
app, and use its client ID and client secret.

Create the required webhooks in Shopify Admin. Point them to
`/webhooks/shopify` and use the webhook signing value as
`SHOPIFY_WEBHOOK_SECRET`.

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
