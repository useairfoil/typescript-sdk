# Code

We want the connector to be easy to read for someone who opens it for the first
time. Keep it clean and simple. No patchy work.

## Structure

Something like this:

```text
src/
  index.ts
  main.ts
  start.ts
  sandbox.ts
  manifest.ts
  connector.ts
  client/        API client, auth, errors
  schemas/       one file per resource, plus shared fields
  resources/     one file per resource
  webhook/       route and signature check
test/
  fixtures/
```

It does not have to match exactly. Skip what you don't need.

## Client

All the API stuff goes in the client: auth, headers, retries, rate limits,
pagination and decoding. Resources should just call the client.

Write pagination once and reuse it.

## Resources and schemas

Keep each resource in its own file. If resources look the same, a small shared
helper is fine, but don't build a framework around it.

One schema per resource that decodes the API response into the row. Don't write
a second schema and map every field by hand.

Follow the provider docs for required and nullable fields. Don't make
everything optional just to be safe.

## Effect

Write proper Effect code, not async code wrapped in Effect. Use services and
layers, `Effect.fn`, `Schema`, `Stream`, and `Schedule` where they fit.

No `as` casts or `any`. If the types don't fit, fix the types.

## Tests

Use `@effect/vitest`. Fake the client with a layer instead of casting.
