# connector-archetypes

Classify the target platform by capability dimensions before writing code.
This is a decision framework, not a list of provider-specific recipes.

For each dimension, record:

- what the official docs say,
- what your v1 scope needs,
- what you will implement now,
- what you defer as follow-up.

## Core capability dimensions

1. **Transport mode**
   - REST, GraphQL, gRPC, or mixed.
   - This selects your primary API client contract and test strategy.

2. **Authentication model**
   - Static token/key, OAuth2, signed requests, or another documented scheme.
   - Mirror provider docs exactly; do not assume another platform's model.

3. **Tenancy model**
   - Single global base URL vs tenant/region/account-specific endpoints.
   - Decide whether one connector instance handles one tenant or many.

4. **Data acquisition model**
   - Polling only, webhook only, push+pull hybrid, or job/bulk export.
   - This determines how `live` and `backfill` streams are wired.

5. **Pagination / continuation contract**
   - Derive request and response continuation semantics from official docs.
   - Validate behavior with recorded traffic and deterministic tests.

6. **Webhook verification model (if applicable)**
   - Determine signed input, canonicalization, algorithm, encoding,
     replay protection, and tolerance directly from docs.
   - Fail closed when verification is enabled but prerequisites are missing.

7. **Versioning model**
   - Header-based, path-based, date-based, or implicit version policy.
   - Pin intentionally and keep code/tests/docs aligned to one version.

8. **Rate limit and retry semantics**
   - Capture throttling behavior (`429`, backoff hints, retry headers).
   - Decide minimal retry/backoff behavior required for v1.

## Decision outputs (required)

Before implementation, your API-facts artifact must include a concise decision
for each dimension above plus links to official sources.

If a dimension is unknown or undocumented, mark it explicitly and ask the user
for the minimum missing inputs needed to proceed.

## Implementation mapping

Use this mapping after classification:

- **Transport mode** -> which mode contract to load (`rest`, `graphql`, `grpc`).
- **Auth model** -> `Config` fields + request middleware strategy.
- **Tenancy model** -> base URL construction and runtime configuration shape.
- **Acquisition model** -> how `live`, `backfill`, and webhooks are composed.
- **Pagination model** -> `fetchList` and cursor handling implementation.
- **Webhook model** -> verifier implementation and webhook test cases.
- **Versioning model** -> config defaults, request paths/headers, README notes.
- **Rate limits** -> retry and error mapping behavior.

## Anti-patterns

- Starting from provider examples without proving applicability to the target.
- Assuming auth, pagination, or webhook verification works like another service.
- Leaving capability dimensions implicit and deciding ad hoc during coding.

Always anchor decisions in official docs first, then validate with observed
traffic and deterministic tests.
