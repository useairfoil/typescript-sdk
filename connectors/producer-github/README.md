# GitHub producer

Syncs repositories, issues, pull requests, and issue comments from one GitHub
App installation. It backfills each resource, takes webhooks at
`POST /webhooks/github`, and polls every 15 minutes to catch missed webhooks.

## Config

| Variable                 | Required | Default |
| ------------------------ | -------- | ------- |
| `GITHUB_APP_CLIENT_ID`   | yes      | none    |
| `GITHUB_APP_PRIVATE_KEY` | yes      | none    |
| `GITHUB_INSTALLATION_ID` | yes      | none    |
| `GITHUB_WEBHOOK_SECRET`  | yes      | none    |

The private key can be on one line with `\n` for newlines.

## Setup

Create a GitHub App under **Developer settings → GitHub Apps**:

- Webhook URL `<connector>/webhooks/github`, with a random secret.
- Repository permissions, read-only: Issues and Pull requests.
- Events: Issues, Issue comment, Pull request, and Repository.

Generate a private key, then install the app and pick the repositories to sync.
The installation ID is the number at the end of the installation page URL.

One app has one webhook URL, so use one app per connector.

## API version

The connector pins REST API version `2026-03-10` with the
`X-GitHub-Api-Version` header.

## Data

- `issues` has no pull requests. `issue_comments` has comments on both.
- Deleted repositories, issues, and comments get `_deleted`. A transferred
  issue is deleted under its old ID.
- A repository's issues, pull requests, and comments stay when it is deleted
  or leaves the installation.
- Bodies are free text. Treat private repository data as confidential.

## Limits

- A column can't go back to null. A reopened issue keeps its old `closed_at`,
  and a removed milestone stays. Use `state`.
- Deletes only come from webhooks. A missed delete stays, even after a new
  backfill. A restored repository comes back once GitHub reports it with a
  newer update time.
- A row deleted during the backfill can make the next page skip one row.
- Polling costs about three requests per repository every 15 minutes. About
  1,000 active repositories reach GitHub's limit.

## Local development

```bash
cd connectors/producer-github
pnpm sandbox
```

Webhooks need a public URL that forwards to
`http://localhost:8080/webhooks/github`.

To record VCR, put the test app's values in `.env`, delete
`test/__cassettes__/api.vcr.test.cassette`, and run `pnpm test:ci`.

`pnpm start` runs the hosted connector. It needs the Wings and PostgreSQL
variables from the Connector Kit README.
