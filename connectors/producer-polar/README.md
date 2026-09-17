# Polar producer

This connector backfills Polar customers, checkouts, orders, and subscriptions.
It gets live events at `POST /webhooks/polar`.

## Config

| Variable                        | Required    | Default                 |
| ------------------------------- | ----------- | ----------------------- |
| `POLAR_ACCESS_TOKEN`            | yes         | none                    |
| `POLAR_WEBHOOK_SECRET`          | yes         | none                    |
| `POLAR_API_BASE_URL`            | hosted only | none                    |
| `POLAR_ORGANIZATION_ID`         | no          | none                    |
| `POLAR_RATE_LIMIT_PER_MINUTE`   | no          | Polar environment limit |
| `POLAR_TRANSIENT_MAX_RETRIES`   | no          | `5`                     |
| `POLAR_RETRY_BASE_DELAY_MS`     | no          | `200`                   |
| `POLAR_REQUEST_TIMEOUT_SECONDS` | no          | `120`                   |

## Setup

Create a [Polar organization access token](https://docs.polar.sh/integrate/oat)
with `customers:read`, `checkouts:read`, `orders:read`, and
`subscriptions:read`. Use it as `POLAR_ACCESS_TOKEN`.

Create a webhook endpoint for `/webhooks/polar` and use its signing secret as
`POLAR_WEBHOOK_SECRET`. Sandbox tokens and webhooks must come from the Polar
sandbox.

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
