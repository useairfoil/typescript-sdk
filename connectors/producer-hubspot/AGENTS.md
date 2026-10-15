# HubSpot producer

## Current scope

- Resources: 27 CRM objects (see `src/resources/objects.ts`),
  `custom_objects`, `owners`, `pipelines`, `properties`, `teams`, and `lists`
- Auth: one service key or static app token, for one account
- Changes: every 5 minutes for CRM objects and custom objects, every hour for
  the rest
- Webhooks: `POST /webhooks/hubspot`, only with `HUBSPOT_CLIENT_SECRET`

## HubSpot rules

- Every request goes through `src/client`, so VCR records it. Paths carry the
  version, such as `/crm/objects/2026-09/...`. There is no version header.
- Search allows 5 requests per second per account. The client keeps it at 4.
  Other calls start at 100 per 10 seconds, and the limiter learns the real
  limit from `X-HubSpot-RateLimit-Max`. `429` retries are capped.
- Full rows come from `batch/read`. Property names are too long for a list URL
  or a search body (3,000 characters).
- Reading a merged ID returns the record it was merged into. Use the `id` in
  the response.
- Association batch reads page per record. Follow each record's `after`.
- Meetings, communications, invoices, payments, subscriptions, users, and deal
  splits reject `archived=true`, and deleted emails are gone right away, so
  none of them has the archived scan.
- Webhook config names objects in the singular, such as `quote`. Meetings are
  `meeting_event`. Deal splits have no webhooks.
- Verify `X-HubSpot-Signature-v3` against the raw body and the URL HubSpot
  called. Skip events from other accounts.

Every version comes from our clock. Rows use the fetch time, because
`updatedAt` doesn't move when calculated properties or associations change.
Deletes use the webhook's arrival time, or the fetch time of the archived scan
or merged record. Rows send `_deleted: false`, so a restored record comes back.

Webhooks read every record again instead of using the payload. A delete is
sent only when the record no longer reads, so a late delete can't hide a
restore.

The changes cursor holds three passes, in order: the search, the archived
list, and the full re-read. The search stops 2 minutes behind now, because
HubSpot's search index lags. Passes start only when a run starts. A run reads
at most 20 pages.

Write the whole `properties` map and association lists on each update.
Adding typed property columns is a schema change and needs approval.

`custom_objects` holds every custom object type in one table, keyed by
`<objectTypeId>:<id>`. Each type is read like a CRM object, with its own entry
in the changes cursor. A type that shows up after the backfill starts with a
full read. Webhooks for any `2-*` type go to it. Custom objects get no
`associationChange` webhook. The type list is cached for an hour.

`properties`, `teams`, and `lists` are small and are read in full every hour.
List members are left out: there is no incremental API, and removals can't be
seen.

Each table needs its own scope or HubSpot feature, so one can be turned off
without breaking another. `properties` and `pipelines` cover the object types
the other tables read (from `src/connector.ts`). They skip a type that fails,
because its own table already reports the error.

For a new CRM object, check its scopes, the archived list, search, and its
association type IDs, and add it to the webhook config in `hubspot-app/`.
`hs project validate` and `hs project upload` against a test account catch bad
object names. Export its row type and schema from `src/index.ts`.

Record VCR against a test account only. Owner and user names and emails are
redacted.

To upgrade the API version, read HubSpot's changelog, update
`HUBSPOT_API_VERSION` and the README, and record VCR again.
