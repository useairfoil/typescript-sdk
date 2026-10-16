# Linear producer

## Current scope

- Resources: 33 (see `manifest.ts`)
- Auth: one personal API key with Read permission
- Changes: every 5 minutes, and every hour for the lists that name IDs
- Webhooks: `POST /webhooks/linear`, for `remove` and `restore` only

## Linear rules

- Every request is a GraphQL query through `src/client`, so VCR records it.
  The API has no version in the URL.
- A personal API key goes in `Authorization` as it is, without `Bearer`.
- A used-up limit returns HTTP 400 with the code `RATELIMITED`. The client
  keeps retrying, with at most 10 minutes between attempts. A failed source
  stays stopped until restart.
- GraphQL errors can come with HTTP 200. "Entity not found" is a missing item.
- `first` can be at most 250, and a query can cost at most 10,000 points. A
  connection multiplies its fields by its `first`, so lists that nest a
  connection use smaller pages.
- Verify `Linear-Signature` against the raw body, and reject a
  `webhookTimestamp` more than a minute old.

Lists read newest first. Backfill pages by `createdAt`. Changes use `updatedAt`
with a one-minute overlap. A run reads at most 20 pages, then resumes from its
cursor. Small lists, such as workflow states, are read in full every hour.

`includeArchived` is always on, so archived and trashed items stay as rows.
Archive, trash, delete, and restore don't change `updatedAt`, so polling never
sees them. Linear sends `remove` for archive, trash, and delete alike, so the
webhook reads the item again and sends a delete only when it's gone. Those rows
use the webhook time as the version. Polled rows use `updated_at`.

We handle webhooks for 14 Linear types. Deletes on the other tables, such as
relations, memberships, and milestones, aren't seen. Release webhooks need the
Business plan.

`issue_history` reads issues with their history nested, and reads the rest of
a long history on its own. Changes read the whole history of each changed
issue again. Archive and restore webhooks also refresh it, since those actions
don't change the issue's `updatedAt`.

Keep GraphQL `Float` as `Finite`, and `Int` as `Long`. Rename a provider field
called `version`; that name is used for the row version.

For a new resource, check its list query, whether it has a webhook type, and
its query cost with the `X-Complexity` header.

Record VCR against a test workspace only. Emails are redacted.
