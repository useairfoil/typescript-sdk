# GitHub producer

## Current scope

- Resources: `repositories`, `issues`, `pull_requests`, `issue_comments`,
  `pull_request_reviews`, `pull_request_review_comments`,
  `pull_request_commits`, `commits`, `check_runs`, `commit_statuses`,
  `workflow_runs`, `workflow_jobs`, `releases`
- Auth: one GitHub App installation
- Backfill: one repository at a time, oldest first when the list can sort
- Changes: every 15 minutes, newest first
- Webhooks: `POST /webhooks/github`

## GitHub rules

- Every request sends `X-GitHub-Api-Version` and goes through `src/client`, so
  VCR records it.
- Follow the `Link` header's `next` URL. The issues list uses a cursor, the
  others page numbers.
- A `429` is a rate limit. A `403` is one only with `retry-after`,
  `x-ratelimit-remaining: 0`, or a rate limit message. Any other `403` fails.
- Verify `X-Hub-Signature-256` against the raw body. Skip deliveries for other
  installations.

The version is `updated_at`. Delete rows use the time the webhook arrived.
Webhook rows come from the payload when it has the whole object. Push, pull
request commits, and statuses read the API, because their payloads don't.

Reviews, check runs, and jobs have no `updated_at`. Their version is the read
time, so their webhooks read the latest state instead of trusting the payload. Commits never change, so their version is the commit time.
`pull_request_commits` uses the pull request's `updated_at`.

Child resources reuse their parent's spec and read each parent's children with
`childRows`: reviews and pull request commits follow pull
requests, check runs and statuses follow default-branch commits, and jobs
follow runs.

Lists that can't sort use `order: "newest"`. Backfill reads every page, and
changes stop after `recentFor`, or read every page without it. Workflow run
filters cap the list at 1,000, so the runs list uses none.

An empty repository has `size` 0, and its commit lists return 409, so commit
resources skip it.

There is no packages resource. Even with the Packages permission, listing
container packages returns 400 for installation tokens.

Not added yet: labels, milestones, issue events, branches, tags, deployments,
check suites, commit comments, and Dependabot and code scanning alerts. Secret
scanning alerts stay out, because their payload has the secret.

Cleared text is `""` and a cleared list is `[]`. Issue, pull request, and
repository webhooks can leave a list out, so their handlers read the object
again.

The changes cursor keeps the last run's start and the repositories it read. A
new repository is read from the start. Changes read newest first, so an edit
during the read repeats a row instead of skipping one. A run reads at most 20
pages, and the cursor's `pending` says where to go on.

Don't loosen a schema to pass a fixture.

For a new resource, check its permission, `since` support, webhook events, and
deletes, and add a read-only check.

Record VCR against a test installation only.

To upgrade the API version, read GitHub's breaking changes, update
`GITHUB_API_VERSION` and the README, and record VCR again.
