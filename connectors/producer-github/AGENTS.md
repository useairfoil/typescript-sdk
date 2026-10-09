# GitHub producer

## Current scope

- Resources: `repositories`, `issues`, `pull_requests`, `issue_comments`
- Auth: one GitHub App installation
- Backfill: one repository at a time, oldest first
- Changes: every 15 minutes, newest first
- Webhooks: `POST /webhooks/github`

## GitHub rules

- Every request sends `X-GitHub-Api-Version` and goes through `src/client`, so
  VCR records it.
- A `401` drops the installation token and tries once more.
- Follow the `Link` header's `next` URL. The issues list uses a cursor, the
  others page numbers.
- Never send an old `since` to read everything. GitHub returns nothing. Leave
  it out.
- `403` and `429` are rate limits only with `retry-after`,
  `x-ratelimit-remaining: 0`, or a rate limit message. Any other `403` fails.
- Verify `X-Hub-Signature-256` against the raw body. Skip deliveries for other
  installations.

The version is `updated_at`. Delete rows use the time the webhook arrived.
Webhook rows come from the payload, without fetching.

A column can't go back to null, so cleared text is `""` and a cleared list is
`[]`. A webhook that leaves a list out leaves it out of the row too.

The changes cursor keeps the last run's start and the repositories it read. A
new repository is read from the start. Changes read newest first, so an edit
during the read repeats a row instead of skipping one. An archived repository
is read once more, then skipped. A run reads at most 20 pages, and the cursor's
`pending` says where to go on.

Don't loosen a schema to pass a fixture.

For a new resource, check its permission, `since` support, webhook events, and
deletes, and add a read-only check.

Record VCR against a test installation only.

To upgrade the API version, read GitHub's breaking changes, update
`GITHUB_API_VERSION` and the README, and record VCR again.
