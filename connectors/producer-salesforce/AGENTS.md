# Salesforce producer

## Current scope

- Resources: 87 standard objects (see `objects` in `src/manifest.ts`),
  `custom_objects`, and `object_fields`
- Auth: client credentials with an External Client App, for one org
- Changes: every 10 minutes, and every hour for setup objects and
  `object_fields`
- Webhooks: none. Push needs Change Data Capture over gRPC.

## Salesforce rules

- Every request goes through `src/client`, so VCR records it. Paths carry the
  version, such as `/services/data/v68.0/sobjects`.
- The token response has no expiry and no refresh token. A token lasts one
  session timeout from when it's issued, at least 15 minutes, so it's renewed
  every 7.5 minutes.
- There is no 429. `403 REQUEST_LIMIT_EXCEEDED` means the daily or concurrent
  limit is used up. The client waits and tries again, up to every 30 minutes,
  because a failed source stays stopped until restart.
- Full rows come from `POST /composite/sobjects/{object}` with `ids` and
  `fields`. The docs page says `recordIds` and `fieldNames`, which the API
  rejects. Fields go in the body because a wide object passes the URL limit.

Changes use `getUpdated` and `getDeleted`, never a query filtered by
`SystemModstamp`. Salesforce says those queries can miss records from running
transactions. The next window starts at `latestDateCovered`, which can be hours
behind, so recent records are read more than once. That's fine, because the
version is the fetch time. Every `getUpdated` and `getDeleted` call reports its
own `latestDateCovered`, so the window keeps the earliest.

`SystemModstamp` doesn't move when a formula reads a changed record, so every
version comes from our clock. Deletes use the time `getDeleted` was read. A
delete is sent only when the record no longer reads, so a restore in the same
window wins.

Windows are whole minutes, because Salesforce ignores seconds. A new org
rejects windows before its replication start. `getDeleted` goes back 15 days,
so an older cursor fails and asks for a backfill.

Describe decides how an object is read. Objects that aren't `replicateable` are
read in full every hour. `BusinessHours` and `Organization` reject
`getDeleted`, so their specs skip it.

A run reads at most 20 pages. The cursor keeps the window, the phase, and the
last ID, so the next run goes on.

`custom_objects` holds every `*__c` object Salesforce can replicate. Each
object has its own cursor. An object that shows up after the backfill is read in
full first. The object list and describes are cached for an hour.

Write the whole `fields` map on each update. Typed columns are a schema change
and need approval.

For a new standard object, check that it's replicateable and supports
`getDeleted`, then add it to `objects` in `src/manifest.ts`.

Record VCR against a test org only. The admin's email and username are
redacted. The VCR test covers one object of each kind, because every describe
is about 100 KB.

To upgrade the API version, read Salesforce's release notes, update
`SALESFORCE_API_VERSION` and the README, and record VCR again.
