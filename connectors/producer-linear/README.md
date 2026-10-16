# Linear producer

Syncs issues and their history, comments, projects, initiatives, cycles,
documents, customers, releases, release notes, and the lists that name their IDs
from one Linear workspace. It backfills each resource, polls for changes, and
uses a webhook for archives, deletes, and restores.

## Config

| Variable                | Required | Default |
| ----------------------- | -------- | ------- |
| `LINEAR_API_KEY`        | yes      | none    |
| `LINEAR_WEBHOOK_SECRET` | yes      | none    |

## Setup

1. Create a personal API key in Linear under Settings > Account > Security &
   access. Choose "Only select permissions" and tick **Read**. Use a
   dedicated user, because the key sees what that user sees, including their
   private teams.
2. As a workspace admin, add a webhook in Settings > Administration > API. Point
   it at `https://<host>/webhooks/linear`, pick all public teams, and tick
   every data change type. Use its signing secret as `LINEAR_WEBHOOK_SECRET`.
   For each private team the key can read, add a webhook for that team too.
   Use the same URL and set the same `secret` through the GraphQL API.

## Data

- Archived and trashed items stay as rows, with `archived_at` and `trashed`.
  Deleted items get `_deleted` on the tables Linear has webhooks for: issues,
  comments, attachments, issue labels, users, cycles, projects, project
  updates, project labels, initiatives, initiative updates, documents,
  customers, and customer needs.
- Deletes on the other tables aren't seen, such as a removed relation or team
  member.
- `issue_history` has one row per change, with the before and after values.
- `projects.team_ids` reads up to 50 teams, and `member_ids` up to 100
  members.
- Customers need customer requests turned on. Releases need the Business plan.
- Tables hold names, emails, and issue and comment text. Treat them as
  confidential.

## Limits

- An API key gets 2,500 requests and 3,000,000 complexity points an hour. A
  used-up limit waits and tries again.
- Large resources are polled every 5 minutes, and the lists that name IDs every
  hour.
- Archive, trash, and restore don't change `updatedAt`, so only the webhook
  sees them. Linear retries a webhook 3 times over about 7 hours.

## Local development

```bash
cd connectors/producer-linear
pnpm sandbox
```

`pnpm start` runs the hosted connector. It needs the Wings and PostgreSQL
variables from the [Connector Kit README](../../packages/connector-kit/README.md).
