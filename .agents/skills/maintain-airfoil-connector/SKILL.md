---
name: maintain-airfoil-connector
description: >-
  Review, debug, fix, or extend an existing Airfoil producer connector. Use for
  existing connector issues, provider changes, missing coverage, or reliability
  work. Do not use for new connectors or Connector Kit-only changes.
---

# Existing connector

Use `review` unless there is already an approved and current connector review.

## Review

Before reviewing the connector, check:

- the root and connector `AGENTS.md`
- the connector README, source, tests, and package scripts
- the Connector Kit code it uses
- recent commits, current changes, and RFCs
- any issue, PR, or discussion shared by the user

Also check the current official provider docs for the parts the connector uses,
including auth, data access, limits, versioning, and recent changes.

Run the existing offline checks. VCR tests should replay without live
credentials.

Write the review in `rfc/<provider>-connector-review.md` using
[references/review.md](references/review.md), and show it in the chat too.

Keep confirmed problems separate from likely problems. Mark anything that still
needs credentials or a real response.

Do not propose work that is already planned elsewhere. Add it under `Known
work` instead.

Do not add scope just because the provider supports more data. If the user asks
to complete the connector, propose a small useful scope and put the rest under
later work with a short reason.

Give a recommendation for anything that is not clear. Wait for approval before
changing the connector.

Keep proposed work in small approval units. A longer roadmap is not approval to
do all of it.

## Work

Work from the approved review in `rfc/`. If there is no approved review, or it
is out of date, go back to review.

Check provider facts that can change before coding. Only make the approved
changes.

Keep the change small. Do not restructure the connector or clean up nearby code
unless the approved work needs it. Ask before a large refactor or a wider
change.

Read [references/code.md](references/code.md) before changing the connector.

Ask again before:

- changing a persisted schema
- adding sensitive data or new provider scopes
- changing auth or user config
- changing Connector Kit
- adding resources outside the approved review

Provider code stays in the connector. If Connector Kit needs a change, explain
the gap and ask first.

Update the connector README and `AGENTS.md` only when its behavior changed.

Do not add a Beachball change file. We add it ourselves later.

## Context

Do not search Slack, Linear, or another private service unless the user asks.
Use any context the user already shared.

## Credentials

Do not ask the user to paste secrets in chat.

Give the setup steps and env var names. If credentials are not available, do
the rest and tell the user what still needs a live check.

## Checks

Run these from the connector package:

```bash
pnpm typecheck
pnpm test:ci
pnpm build
```

After code changes, run formatting and lint from the repo root:

```bash
pnpm format
pnpm lint
```

Report what passed and what still needs credentials.
