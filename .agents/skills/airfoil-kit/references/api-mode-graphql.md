# api-mode-graphql

Implementation contract for connectors whose upstream API is GraphQL.

Use this file when `api-facts.md` declares `mode: graphql`.

## Hard rules

1. **Effect HTTP is the default transport.** Use `HttpClient` from
   `effect/unstable/http` and keep GraphQL over normal HTTP POST.
2. **No inline query strings in stream/connector logic.** Put operations in
   `src/graphql/operations.ts` (or equivalent) and import them.
3. **Do not ignore GraphQL `errors`.** Handle `{ data, errors }` explicitly and
   map to typed `ConnectorError`.
4. **Decode only at typed boundaries.** Validate response envelopes and entity
   payloads with `Schema`.
5. **Pin API version once** (header/path/config), then mirror that same value
   in code, tests, `.env.example`, and README.

## Suggested file layout

```text
src/
  graphql/
    operations.ts   # query/mutation constants + operation names
    envelopes.ts    # optional: shared GraphQL envelope schemas
  api.ts            # HttpClient + request helpers
  schemas.ts        # entity schemas
  streams.ts
  connector.ts
```

Use `src/graphql/envelopes.ts` only when multiple operations share envelope
types. For small connectors, keep envelope schema in `api.ts`.

## Request pattern

Use a single helper for GraphQL requests in `api.ts`:

- Build POST request to endpoint (`/graphql` or `/graphql.json`).
- Set auth/version headers centrally.
- Set body `{ query, variables }`.
- Execute in `Effect.scoped(...)`.
- Parse JSON once and decode through a response envelope schema.

This keeps pagination/auth/error behavior in one place.

Minimal skeleton:

```ts
const GraphQLEnvelope = Schema.Struct({
  data: Schema.optional(Schema.Any),
  errors: Schema.optional(Schema.Array(Schema.Struct({ message: Schema.String }))),
});

const requestGraphql = <A>(options: {
  readonly query: string;
  readonly variables?: Record<string, unknown>;
  readonly decodeData: (data: unknown) => Effect.Effect<A, unknown>;
}) =>
  Effect.scoped(
    client
      .execute(
        HttpClientRequest.post("/graphql").pipe(
          HttpClientRequest.bodyJsonUnsafe({
            query: options.query,
            variables: options.variables,
          }),
        ),
      )
      .pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap((response) => response.json),
        Effect.flatMap(Schema.decodeUnknownEffect(GraphQLEnvelope)),
        Effect.flatMap((envelope) => {
          if ((envelope.errors?.length ?? 0) > 0) {
            return Effect.fail(
              new ConnectorError({
                message: "GraphQL returned errors",
                cause: envelope.errors,
              }),
            );
          }
          if (envelope.data == null) {
            return Effect.fail(new ConnectorError({ message: "GraphQL response missing data" }));
          }
          return options.decodeData(envelope.data);
        }),
        Effect.mapError(
          (cause) =>
            new ConnectorError({
              message: "GraphQL request failed",
              cause,
            }),
        ),
      ),
  );
```

## Response envelope standard

Model the envelope as:

```ts
Schema.Struct({
  data: Schema.optional(Schema.Any),
  errors: Schema.optional(
    Schema.Array(
      Schema.Struct({
        message: Schema.String,
        path: Schema.optional(Schema.Array(Schema.Union(Schema.String, Schema.Number))),
      }),
    ),
  ),
});
```

Then enforce:

- if `errors` is non-empty: fail typed
- if `data` missing: fail typed
- else decode `data.<entity>` with concrete schema

## Pagination rules

For connection-based APIs (`edges/pageInfo`):

- map `edges[].node` to connector rows
- use `pageInfo.hasNextPage` + `pageInfo.endCursor` for continuation
- keep cursor mapping in one helper, not scattered

If the API uses non-connection patterns, document exact continuation fields in
`api-facts.md` and implement one deterministic mapper.

## Error mapping contract

Map failures into `ConnectorError` with specific messages:

- request/transport failure
- non-OK HTTP status
- GraphQL `errors` present
- schema decode failure

Never expose raw unknown failures directly from connector boundaries.

## Library policy

- **Default:** no GraphQL runtime client library (stay on Effect HttpClient).
- **Optional:** GraphQL code generation (`@graphql-codegen/*`) for typed
  operation results when introspection/schema tooling is stable.

If codegen is introduced, document how to regenerate and keep generated files
out of handwritten logic modules.

## Required tests

1. VCR-backed list/backfill replay test from real GraphQL responses.
2. Pagination boundary test (hasNextPage false or empty edges).
3. GraphQL error path test (`errors` present => fail typed).
4. Webhook tests when applicable (including signature failure path).

## Anti-patterns

- Writing raw query strings inline in `streams.ts`/`connector.ts`.
- Treating HTTP 200 as success while ignoring GraphQL `errors`.
- Decoding directly to `Schema.Any` for shipped entities.
- Choosing query fields from memory instead of cassette-observed payloads.
