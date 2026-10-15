# GitHub producer

Syncs repositories, issues, pull requests, comments, reviews, commits, checks,
Actions runs and jobs, and releases from one GitHub App installation. It
backfills each resource, takes webhooks at `POST /webhooks/github`, and polls
for changes every 15 minutes.

| Resource                       | What                                            |
| ------------------------------ | ----------------------------------------------- |
| `repositories`                 | Repositories the installation can read          |
| `issues`                       | Issues, without pull requests                   |
| `pull_requests`                | Pull requests                                   |
| `issue_comments`               | Comments on issues and pull requests            |
| `pull_request_reviews`         | Pull request reviews                            |
| `pull_request_review_comments` | Comments on pull request diffs                  |
| `pull_request_commits`         | Commits in each pull request                    |
| `commits`                      | Commits on the default branch                   |
| `check_runs`                   | Check runs, such as Actions jobs and other apps |
| `commit_statuses`              | Commit statuses from CI services                |
| `workflow_runs`                | Actions workflow runs                           |
| `workflow_jobs`                | Jobs of workflow runs, with their steps         |
| `releases`                     | Releases, with their assets                     |

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
- Repository permissions, read-only: Actions, Checks, Commit statuses,
  Contents, Issues, and Pull requests.
- Events: Check run, Issue comment, Issues, Pull request, Pull request review,
  Pull request review comment, Push, Release, Repository, Status, Workflow
  job, and Workflow run.

Generate a private key, then install the app and pick the repositories to sync.
The installation ID is the number at the end of the installation page URL.

One app has one webhook URL, so use one app per connector.

## API version

The connector pins REST API version `2026-03-10` with the
`X-GitHub-Api-Version` header.

## Data

- `issues` has no pull requests. `issue_comments` has comments on both.
- Deleted repositories, issues, comments, and releases get `_deleted`. A
  transferred issue is deleted under its old ID.
- `commits` and `pull_request_commits` keep author and committer names, not
  emails.
- Reviews, check runs, and jobs have no update time in GitHub. Their version
  is when the connector read them.
- A repository's issues, pull requests, and comments stay when it is deleted
  or leaves the installation.
- Bodies are free text. Treat private repository data as confidential.

## Limits

- Deletes only come from webhooks. A missed delete stays, even after a new
  backfill. A restored repository comes back once GitHub reports it with a
  newer update time.
- A row deleted during the backfill can make the next page skip one row.
- `commits` is the default branch only. Polling uses the commit time, so an
  old commit pushed later only comes by webhook.
- Check runs and statuses are polled once, soon after a default-branch commit,
  so a check that finishes later only updates by webhook. Webhooks bring them
  for every branch.
- `pull_request_commits` has at most 250 commits per pull request. Commits
  removed by a force push stay.
- A release asset's `download_count` is from the last time the release
  changed.
- Workflow runs are polled for a day after they start. A later re-run comes by
  webhook. A run row is its latest attempt; jobs keep every attempt.
- Reviews, pull request commits, check runs, statuses, and jobs cost one
  request per pull request, commit, or run, in backfill and for each change.
  A big repository with years of CI can take hours of rate limit to backfill.
- Polling costs about 12 requests per repository every 15 minutes, plus the
  ones above. About 250 active repositories reach GitHub's limit.

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
