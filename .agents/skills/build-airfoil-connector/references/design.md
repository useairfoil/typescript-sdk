# Connector brief

## Brief

Save it as `rfc/<provider>-connector-brief.md`.

````md
# <Provider> connector brief

## Summary

What the provider is, the API type and version, and useful official docs.

## Auth

Auth we should use, setup needed on the provider, and scopes. Mention another
option only when it is a real choice.

## Config

| Field | Runtime key | Type | Required | Default | Notes |
| ----- | ----------- | ---- | -------- | ------- | ----- |

## Resources

| Resource | Why | Backfill | Changes | Webhook | Deletes |
| -------- | --- | -------- | ------- | ------- | ------- |

Later: <resource> - <reason>

## <resource>

- Endpoints:
- Key:
- Version: field, type, and format
- Backfill: pagination and cutoff
- Changes: API, cursor, and interval
- Webhook: events and row mapping
- Delete: detection and update
- Restore: provider behavior and update, if supported
- Rate limits and retries:
- Check: read-only API call
- Schema risks:

Iceberg fields:

```json
[]
```

## Connector Kit gaps

What is missing and which resource needs it.

## Live checks

What needs real credentials and the env vars for it.

## Decisions

Anything we still need to decide. Include a recommendation and reason.
````

## Scope

Start small with what customers will actually use. We do not need every object
from the API. Put the useful remaining ones under `Later`.

## Key

`Resource.entity` has one key. It is required and cannot be null. Join multiple
IDs when needed:

```ts
const IssueSchema = Schema.Struct({
  key: Schema.String, // `${repositoryId}:${number}`
  repositoryId: Schema.Number,
  number: Schema.Number,
});
```

## Version

For version, use the first one that is reliable:

1. Provider update time or sequence number.
2. Event time when the provider guarantees ordering.
3. Fetch time when there is no provider version.

If we use fetch time, fetch the object again when a webhook comes in. A webhook
that arrived later is not always newer. Mention this in `AGENTS.md`.

Use the same type and format everywhere. Use `Date` for `timestamptz` and
`toISOString()` when the version is a string.

If backfill has no useful version but webhooks do, give backfill rows an old
version so webhook rows win. The template uses
`1970-01-01T00:00:00.000Z`.

## Backfill and updates

Backfill uses `Fetch.page`, has a cutoff, and returns full rows. Use something
like `created <= cutoff` when the API supports it.

`changes` and webhooks return `ResourceUpdate`. Key and version are required;
other fields may be omitted. Do not use casts to bypass this.

Decide polling and webhooks for each resource. Check event coverage, retries,
ordering, signatures, and how expensive polling is.

If webhooks are the only update path, see if an events or updated-since API can
recover missed events.

## Deletes

For a delete, send the key, version, and `_af_deleted: true`. The table needs
the `_af_deleted` column.

Check what delete means for the provider. An event can say deleted even when
the row should stay in our table.

If the provider has restore events, add it under `Decisions`. We still need to
agree how restores should work.

## Reports

Report values can change later, even for the same day and dimensions.

The brief should decide:

- which dimensions make the key
- what we use as version
- how many days we fetch again on each run

Use the provider docs to suggest the lookback. If we add `lookbackDays`, make
it a positive integer config value.

## Config

The manifest supports string, number, boolean, select, and secret fields.

There is no list field. A comma-separated string is one option for repos, ad
accounts, or similar values. Add the choice to the brief if it affects setup.

Only add things the customer needs to choose.

## Auth

Use customer-managed apps when the provider supports them and it makes sense.

The connector can take API keys, client IDs, client secrets, and refresh
tokens. There is no OAuth flow in the current connector setup.

Use read-only or restricted access where possible. List the exact scopes.

## Dynamic schemas

Start with normal resources and fixed schemas.

Ask before adding Salesforce objects, HubSpot properties, Google Analytics
dimensions, Facebook Ads breakdowns, or any other dynamic schema. Do not use a
loose schema just to make it work.

## Tables

The connector does not create its tables. Add the Iceberg fields for each
resource to the brief:

```json
[
  { "id": 1, "name": "id", "type": "string", "required": true },
  { "id": 2, "name": "version", "type": "timestamptz", "required": true },
  { "id": 3, "name": "_af_deleted", "type": "boolean", "required": false }
]
```

For local setup:

```bash
airfoil table create default.customers --schema '<fields json>'
```
