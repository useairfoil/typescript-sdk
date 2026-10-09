# Polar producer

This connector backfills Polar customers, checkouts, orders, subscriptions,
refunds, products, and discounts.
It gets live events at `POST /webhooks/polar`.

## Config

| Variable                | Required    | Default |
| ----------------------- | ----------- | ------- |
| `POLAR_ACCESS_TOKEN`    | yes         | none    |
| `POLAR_WEBHOOK_SECRET`  | yes         | none    |
| `POLAR_API_BASE_URL`    | hosted only | none    |
| `POLAR_ORGANIZATION_ID` | no          | none    |

## Setup

Create a [Polar organization access token](https://docs.polar.sh/integrate/oat)
with `customers:read`, `checkouts:read`, `orders:read`, `subscriptions:read`,
`refunds:read`, `products:read`, and `discounts:read`. Use it as
`POLAR_ACCESS_TOKEN`.

Create a webhook endpoint for `/webhooks/polar` and use its signing secret as
`POLAR_WEBHOOK_SECRET`. Sandbox tokens and webhooks must come from the Polar
sandbox. Subscribe it to the `customer.*`, `checkout.*`, `order.*`,
`subscription.*`, `refund.*`, `product.*`, and `discount.*` events. The
connector acknowledges other events without storing them.

## API version

The connector pins Polar API version `2026-10` with the `Polar-Version` header.
Set the webhook endpoint API version to `2026-10`. The connector returns `400`
for any other version.

## Limits

Deleted products stay in the `products` table because Polar has no
`product.deleted` webhook. Subscriptions without `started_at` can be missed
during a backfill because Polar has no stable sort for them. After backfill,
updates depend on webhooks. Missed webhook deliveries are not recovered yet.

## Local development

The sandbox uses the Polar sandbox API.

```bash
cd connectors/producer-polar
pnpm sandbox
```

A hosted run loads connector config from `AIRFOIL_CONFIG_PATH`. It also needs
the Wings and PostgreSQL variables from the Connector Kit README.

```bash
cd connectors/producer-polar
pnpm start
```
