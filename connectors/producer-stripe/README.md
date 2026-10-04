# Stripe producer

This connector syncs Stripe customers, products, prices, subscriptions,
invoices, charges, and refunds. It backfills each resource, gets live events at
`POST /webhooks/stripe`, and polls the Stripe Events API every 5 minutes to
recover missed webhooks.

## Config

| Variable                       | Required | Default |
| ------------------------------ | -------- | ------- |
| `STRIPE_API_KEY`               | yes      | none    |
| `STRIPE_WEBHOOK_SECRET`        | yes      | none    |
| `STRIPE_RATE_LIMIT_PER_SECOND` | no       | `20`    |

The rate limit is shared by all resources. Stripe limits requests per account,
so lower it if other services use the same account heavily.

## Setup

Create a [restricted API key](https://docs.stripe.com/keys/restricted-api-keys)
in the Dashboard: **API keys → Create secret key → Building your own
integration → Custom permissions**. Set **Read** on these seven permissions and
leave the rest at None:

- Customers
- Products
- Prices
- Subscriptions
- Invoices
- Charges and Refunds
- Events

Use the key as `STRIPE_API_KEY`. A sandbox key reads sandbox data and a live
key reads live data, so run one connector for each.

Create a webhook endpoint for `/webhooks/stripe` and use its signing secret as
`STRIPE_WEBHOOK_SECRET`. The endpoint can use any API version. Subscribe it to:

- `customer.created`, `customer.updated`, `customer.deleted`
- `product.created`, `product.updated`, `product.deleted`
- `price.created`, `price.updated`, `price.deleted`
- `customer.subscription.created`, `.updated`, `.deleted`, `.paused`,
  `.resumed`, `.pending_update_applied`, `.pending_update_expired`
- `invoice.created`, `.updated`, `.deleted`, `.finalized`,
  `.finalization_failed`, `.paid`, `.payment_succeeded`, `.payment_failed`,
  `.payment_action_required`, `.voided`, `.marked_uncollectible`, `.overpaid`
- `charge.succeeded`, `.failed`, `.pending`, `.captured`, `.expired`,
  `.refunded`, `.updated`
- `refund.created`, `refund.updated`, `refund.failed`, `charge.refund.updated`

The connector acknowledges other events without storing them.

## API version

The connector pins Stripe API version `2026-09-30.endive` with the
`Stripe-Version` header.

## Data

- Rows are fetched from the API, never taken from event payloads. The row
  version is the time the response arrived.
- Deleted customers, products, prices, and draft invoices are marked with
  `_deleted`. A canceled subscription stays as a row with
  `status = canceled`.
- Customers, invoices, and charges hold customer data: names, emails, phone
  numbers, addresses, and card last4, expiry, and fingerprint. Treat these
  tables as customer data.
- Stripe leaves out the card fingerprint for restricted keys without payment
  method access, so `payment_method_details.card.fingerprint` can be empty.
- Invoice line items are not synced yet.
- Test clocks are not supported. Test clock objects can arrive through events
  but are left out of backfills. Filter them with `test_clock`.

## Limits

Stripe keeps events for 30 days. If the connector falls about 29 days behind,
changes stop for all resources, and they need a new backfill.

One Events API poll covers all resources. A run reads up to 20 pages. If more
events are waiting, the next run starts right away.

Polling uses about 9,000 reads a month, plus one read for each changed object.
Stripe allows an average of 500 reads per transaction, with at least 10,000 a
month, so very quiet accounts can go over and get throttled.

## Local development

```bash
cd connectors/producer-stripe
pnpm sandbox
```

Forward test webhooks with the Stripe CLI. `stripe listen --print-secret`
prints the signing secret to use as `STRIPE_WEBHOOK_SECRET`. Recent CLI
versions need the events to forward, so pass the list from Setup:

```bash
stripe listen --forward-to localhost:8080/webhooks/stripe \
  --events customer.created,customer.updated,invoice.paid,charge.refunded
stripe trigger customer.updated
```

To record the VCR cassette, put a sandbox key in `.env`, delete
`test/__cassettes__/api.vcr.test.cassette`, and run `pnpm test:ci`. Check the
new cassette for customer details before committing it.

A hosted run loads connector config from `AIRFOIL_CONFIG_PATH`. It also needs
the Wings and PostgreSQL variables from the Connector Kit README.

```bash
cd connectors/producer-stripe
pnpm start
```
