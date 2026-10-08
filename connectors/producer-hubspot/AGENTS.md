# HubSpot producer

## Current scope

- Resources: 11 CRM objects (`contacts`, `companies`, `deals`, `tickets`,
  `calls`, `emails`, `meetings`, `notes`, `tasks`, `line_items`, `products`),
  plus `owners` and `pipelines`
- Auth: one service key or static app token, for one account
- Changes: every 5 minutes for CRM objects, every hour for owners and pipelines
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
- Meetings reject `archived=true`, and deleted emails are gone right away, so
  neither has the archived scan.
- Verify `X-HubSpot-Signature-v3` against the raw body and the URL HubSpot
  called. Skip events from other accounts.

Every version comes from our clock. Rows use the fetch time, because
`updatedAt` doesn't move when calculated properties or associations change.
Deletes use the webhook's arrival time, or the fetch time of the archived scan
or merged record. Rows send `_deleted: false`, so a restored record comes back.

Webhooks read every record again instead of using the payload. A delete is
sent only when the record no longer reads, so a late delete can't hide a
restore.

The changes cursor holds four passes, in order: the recent search, a search
that trails an hour behind, the archived list, and the full re-read. Passes
start only when a run starts. A run reads at most 20 pages.

The whole `properties` map and the association lists are written on each
update. A column can't go back to null, so don't add typed columns for
properties.

For a new CRM object, check its scopes, the archived list, search, and its
association type IDs, and add it to the webhook config in `hubspot-app/`.

Record VCR against a test account only. Owner names and emails are redacted.

To upgrade the API version, read HubSpot's changelog, update
`HUBSPOT_API_VERSION` and the README, and record VCR again.
