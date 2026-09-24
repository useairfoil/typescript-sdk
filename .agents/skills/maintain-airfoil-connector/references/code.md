# Connector changes

Keep the existing connector structure unless the approved work needs a change.
Fix the actual cause. No patchy work.

## Schemas

Keep every existing Iceberg field ID stable. Never reuse a removed ID. IDs are
unique across the full table schema.

Use `Iceberg.field` for struct fields. List elements and map keys and values need
their own IDs with `.annotate({ fieldId })`.

These all change a persisted schema:

- adding, removing, or renaming a field
- changing a field type
- changing required or optional
- changing a field ID, including nested list or map fields

Hosted startup creates a missing table from the resource schema. For an existing
table, Connector Kit checks field count, names, IDs, required fields, types, and
nested list and map IDs. A mismatch fails startup and must be migrated or
reverted.

There is no schema migration flow yet. Stop and ask before making one of these
changes.

## Rows

Every path that writes a resource must produce compatible rows. Keep the key
and version type and format the same in every path.

Rows must match the Iceberg table:

- `Date` for `timestamptz`
- `bigint` for `long`
- `ReadonlyMap` for `map`

Extra fields fail. One bad backfill or change row stops that resource until
restart.

Partial updates cannot set a column back to null.

Backfill runs once. Do not use it as recovery unless the connector resets it.

For change polling, make sure equal timestamps and page boundaries cannot skip
rows.

## Provider behavior

Use current official docs and real recorded responses. Recheck the provider
contract the change depends on, such as auth, data access, limits, pagination,
or delivery behavior.

Check data protection for the full resource, not only obvious personal fields.

Use VCR for provider HTTP calls. Do not edit cassettes by hand. If credentials
are missing, keep the tests and give the command to record them later.

If a refetch confirms that an entity was deleted, do not return no rows when
that can leave old data active.

`after-enqueue` uses an in-memory queue. Before changing the ack mode, check
every resource using that route and how each one recovers lost data.

## Effect

Stay Effect-first. Use Effect services, layers, errors, retries, and resource
handling instead of wrapping async code in Effect. Follow the connector's
existing Effect patterns.

No `as` casts or `any`. If the types don't fit, fix the types.

Use `@effect/vitest`. Fake the client with a layer instead of casting.

We use Effect 4. The v4 docs are still in progress, so check the repo too:

- https://effect.website/docs/v4
- https://github.com/Effect-TS/effect/blob/main/LLMS.md

## Comments

Add a comment or JSDoc only when the code does not explain itself. Keep it
short and use simple words.

Do not comment obvious code. Do not add comments to every function or type.
Keep useful existing comments unless they are wrong.

## Docs

Only document behavior that exists. Keep the README and `AGENTS.md` in their
current short style.
