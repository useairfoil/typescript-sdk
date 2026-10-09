# Stripe producer

## Current scope

- Resources: `customers`, `products`, `prices`, `subscriptions`, `invoices`,
  `charges`, and `refunds`
- Backfill: Stripe list endpoints
- Changes: one Stripe Events API feed for all resources, every 5 minutes
- Webhooks: `POST /webhooks/stripe`

## Stripe rules

- Send `Stripe-Version: STRIPE_API_VERSION` on every request.
- Every API request goes through the Effect `HttpClient` in `src/client`, so
  VCR records it. Use the `stripe` package only for helpers that make no
  requests, such as webhook signatures.
- Lists use `limit=100` and `starting_after`. Backfill filters on
  `created[lte]`.
- All requests share one rate limiter. `429` and other transient responses
  are retried with backoff. Every request has a timeout.
- Verify `Stripe-Signature` against the raw body with
  `Stripe.webhooks.constructEvent`.

Stripe objects have no reliable update time, Stripe does not order events, and
event payloads use old API versions. So rows are always fetched again, and the
version is the request time. Never map an event payload into a row.

`customer.deleted`, `product.deleted`, `price.deleted`, and `invoice.deleted`
write a delete row without fetching, because the object is gone. A delete wins
over other events for the same object in a batch.
`customer.subscription.deleted` means canceled: fetch the subscription and keep
it.

Changes use one Connector Kit feed (`Fetch.feed` in `connector.ts`). Stripe
filters on at most 20 event types and we use more, so the feed reads every
event and routes it by type. Some events have no object ID, such as
`invoice.upcoming`, so only events a resource handles must have one.

The feed reads fixed time windows that start five minutes early. A run reads up
to 20 pages, saves the window end and last event in the cursor, and sets
`hasMore` so the next run starts right away.

Subscriptions embed their items. Stripe embedded all 20 items, the maximum, in
a sandbox, but `toRow` still pages the rest when `has_more` is true.

Keep nested objects nested, with Stripe's field names. Decode enum fields as
strings, so a new Stripe value does not stop the resource.

Do not loosen a schema only to pass a fixture.

When adding a resource, check its restricted key permission, list filters,
event types, delete behavior, and nullable fields in the API
reference. Add a read-only config check.

Record VCR against a sandbox without test clocks. Remove customer details from
the cassette.

To upgrade the API version, read the
[Stripe changelog](https://docs.stripe.com/changelog) for the resources and
events we use. Update `STRIPE_API_VERSION` and the README. Then re-record the
VCR cassette.
