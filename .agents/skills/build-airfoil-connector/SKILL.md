---
name: build-airfoil-connector
description: >-
  Plan and build a new Airfoil producer connector, such as Stripe, GitHub, or
  HubSpot etc. Use for new connectors only, not changes to existing connectors or
  Connector Kit.
---

# New connector

Use `plan` unless there is already an approved brief.

## Plan

Before making the plan, check:

- the root `AGENTS.md`
- `packages/connector-kit`
- `templates/producer-template`

Also check the official provider docs for the API, auth, webhooks, rate limits,
and recent changes. Add the useful links to the brief.

Write the brief in `rfc/<provider>-connector-brief.md` using
[references/design.md](references/design.md), and show it in the chat too.

The brief should tell us:

- what we sync now and what can come later
- which auth and scopes we use
- where we use polling, webhooks, or both
- whether one connector can read multiple accounts
- which personal data we keep
- any API limit that can leave data missing
- whether Connector Kit is missing something

Give your recommendation for anything that is not clear. Wait for approval
before writing the connector.

## Build

Build from the approved brief in `rfc/`. If there is no approved brief, go
back to plan.

Check the API version, scopes, and webhook events again before coding.

Start from `templates/producer-template`. Keep the sandbox and hosted setup
unless the brief needs something else.

For folder structure and code style, see [references/code.md](references/code.md).

Get one resource working fully before doing the rest. Only build what is in the
brief.

Provider code stays in the connector. If Connector Kit needs a change, explain
the change and ask first.

Add a short `README.md` and `AGENTS.md` in the same style as the other
connectors.

Do not add a Beachball change file. We add it ourselves later.

## Resource rules

Every resource needs a key and version. Both are required and cannot be null.

There is only one key field. Join multiple provider IDs into one string if
needed.

Keep the version type and format the same in backfill, changes, and webhooks.
The version must order updates for the same row.

Rows must match the Iceberg table:

- `Date` for `timestamptz`
- `bigint` for `long`
- `ReadonlyMap` for `map`

Extra fields fail. Check `packages/connector-kit/src/ingestor/arrow.ts` for
other types.

One bad backfill or change row stops that resource until restart.

For a delete, send the key, version, and `_af_deleted: true`. Only do this when
the table has `_af_deleted`. Normal rows can omit the field.

Partial updates cannot set a column back to null.

Try not to depend only on webhooks. If the provider has events or an
updated-since API, use it in `changes` to recover missed webhooks.

Put user config in the manifest. Do not expose internal settings unless there
is a reason for the customer to change them.

Use Effect `HttpClient` for API calls. Use a provider SDK when it handles
signing or some provider-specific protocol we should not maintain ourselves.

Verify webhook signatures from the raw body.

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

Run formatting and lint from the repo root:

```bash
pnpm format
pnpm lint
```

Tests should cover pagination, cutoff, webhook signatures, deletes, and the
check for each resource where they apply.

Use VCR for API tests. Do not edit cassettes by hand. If credentials are
missing, keep the tests and give the command to record them later.

Report what passed and what still needs credentials.

## Effect

We use Effect 4. The v4 docs are still in progress, so check the repo too:

- https://effect.website/docs/v4
- https://github.com/Effect-TS/effect
- https://github.com/Effect-TS/effect/blob/main/LLMS.md
- https://github.com/Effect-TS/effect/tree/main/ai-docs
