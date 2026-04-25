# api-research

Gathering the minimum set of facts about a target API before you write
any code. The output of this phase is a short API-facts artifact
(`api-facts.md` by default) kept in the connector directory during
development (required during implementation), plus a clear picture of
which archetype applies.

## Hard rule

**Never fabricate API behavior or response shape.** Treat official platform
docs and version/changelog pages as the contract source of truth, and use
recorded traffic to validate implementation and capture real payload details.
If you can't record, you can't ship the connector — stop and ask the user for
creds.

## Tool availability fallback

If MCP tools (Context7, DeepWiki, service MCPs) are unavailable, continue.
They are accelerators, not requirements.

Fallback stack:

1. Local repo source of truth (`AGENTS.md`, connector-kit, effect-vcr,
   producer-polar, producer-template).
2. Official vendor docs using normal web fetch/search.
3. User clarification for missing secrets/scope decisions.

Do not pause implementation solely because MCPs are missing.

## Research order

Source-of-truth precedence (always apply this order):

1. Official vendor docs + changelog/version policy.
2. Official vendor SDK docs/examples.
3. Internal repo patterns (`connector-kit`, `effect-vcr`,
   `producer-polar`, template).
4. Community posts/issues/videos (non-authoritative; use only as hints).

Tooling order (how you gather the above sources):

1. **Context7 MCP**. Use it first for any well-known
   library or SaaS with public SDK docs. Example:

   ```
   server: plugin-context7-plugin-context7
   tool: get-library-docs (or whatever the server exposes)
   args: { library: "stripe" }
   ```

   Always read the tool descriptor first; tool names and argument shapes
   can change.

   If you need direct API details (auth, endpoints, rate limits), use:
   `https://context7.com/docs/api-guide`.

2. **WebFetch** the platform's official docs pages for specifics Context7
   doesn't cover. Example URLs to grab:
   - Auth docs (`/docs/api/authentication`).
   - Pagination docs (`/docs/api/pagination`).
   - Webhook catalog (`/docs/webhooks/events`).
   - Reference schemas for the entities you plan to ingest.

3. **Targeted web searches** for stack-specific gotchas: rate limits,
   retry semantics, undocumented headers, known quirks.

4. **Context7 for Effect v4 docs** using `effect-ts/effect-smol`
   (plus DeepWiki as optional fallback) for service tags, layers, Config
   idioms, and HTTP module locations.

5. **Ask the user** when anything material is ambiguous:
   - Which tenancy model? (single-tenant vs per-tenant URL).
   - Which auth flow is acceptable for MVP? (static token vs full OAuth2).
   - Do they have sandbox/test-mode creds, or is this live-only?
   - Are there MCP seeders available (e.g. Stripe MCP) for test-data?
   - Which entities matter **for v1**?

## Evidence block (required)

Your API-facts artifact must include a short evidence block before
implementation:

```markdown
## Evidence

- URL: <official doc or changelog URL>
- Retrieved: YYYY-MM-DD
- Used for: <auth|pagination|webhook|version>
- Decision: <selected behavior/version>
```

Minimum requirement: one evidence entry each for auth, pagination, webhook
contract (or explicit no-webhook), and selected API version.

## Version pin checklist (required)

When you choose an API version, update all of these in one pass:

1. Connector config default or required version field.
2. API client path/header/query parameter carrying version.
3. `.env.example` variable/value guidance.
4. README version notes.
5. Tests/cassettes targeting that versioned endpoint.

Do not leave mixed versions across code/tests/docs.

## Shape of the API-facts artifact

Keep the summary small and concrete:

```markdown
# api-facts: <service>

## Mode

- mode: rest | graphql | grpc
- rationale: <why this mode applies>

## Evidence

- URL: <official doc or changelog URL>
- Retrieved: YYYY-MM-DD
- Used for: <auth|pagination|webhook|version>
- Decision: <selected behavior/version>

## Base URL

- Production: https://api.<service>.com/v2
- Sandbox: https://sandbox.<service>.com/v2 (same shape)

## Auth

- Scheme: Bearer token
- Header: `Authorization: Bearer <token>`
- Token lifetime: long-lived API key
- Env var: `<SERVICE>_API_TOKEN`

## Pagination

- Style: cursor-based
- Request: `?starting_after=<id>&limit=<n>`
- Response: `{ data: [...], has_more: boolean }`
- Last item's `id` becomes the next cursor.

## Entities (v1)

- `users`: GET /users (list), GET /users/:id (get)
- `orders`: GET /orders (list), webhook on `order.created`

## Webhooks

- Endpoint we host: POST /webhooks/<service>
- Signature header: `<Service>-Signature`
- Scheme: HMAC-SHA256 of raw body, hex lowercase
- Timestamp tolerance: 5 min

## Rate limits

- 100 req/sec per API key, 429 w/ Retry-After.
```

## What to actually record (and why)

Record **minimum sufficient** cassettes:

- **One page of each list endpoint** you plan to back-fill.
- **One detail fetch** per entity if you use it.
- **One webhook payload of each type** you dispatch (captured separately
  — copy from the platform's dashboard or webhook debugger; webhooks
  aren't captured by the HTTP client layer).
- **One auth error** (401) if your error handling depends on distinguishing
  it.

For gRPC mode, replace HTTP cassettes with deterministic proto fixtures and/or
mock gRPC server recordings.

Do NOT record hundreds of pages. Large cassettes:

- Bloat the repo.
- Slow replay tests.
- Leak real tenant data even when redacted.

After recording, re-open the payloads and reconcile schema depth with observed
nested fields required by v1 entities/events. Do not stop at a minimal schema
if downstream logic or users need nested data.

## Minimum required facts before coding

Do not start connector implementation until the API-facts artifact contains all
of:

1. Base URL(s) and environment model (sandbox/prod or key-mode).
2. Auth scheme and exact header names.
3. Pagination contract (request params + response continuation fields).
4. Concrete v1 entity list and list endpoints.
5. Webhook signature contract (header names, canonical signed string,
   encoding, timestamp tolerance) or explicit "no signed webhooks".
6. Rate-limit behavior (`429`, `Retry-After`, burst/sustained limits if known).

## Decision points the user owns

If any of these are unclear, **stop and ask**:

- **Which entities to ingest in v1.** Be explicit; listing 20 entities
  and shipping 3 is a scope problem.
- **How to handle tenant-specific URLs.** Are multiple tenants
  multiplexed into one connector instance, or does each tenant run its
  own instance?
- **Retention of historical data.** Does backfill need to go back 1 year
  or all-time? Affects `initialCutoff` and pagination strategy.
- **Credentials scope.** Read-only vs read-write. Prefer the minimum.

## Anti-patterns

- Reading an existing `producer-<target>` repo to crib its schemas —
  this is anti-cheat territory. See `anti-cheat.md`.
- Writing the schema from "I remember Stripe has a `created` field".
  Memory is not ground truth; the cassette is.
- Assuming the sandbox and production APIs have identical shapes. Most
  do, but not all (e.g., Shopify dev stores expose extra debug fields).
- Asking a dozen questions before doing any research. Research first,
  then surface a focused question list.

## When to use which tool

| Need                                         | Tool                               |
| -------------------------------------------- | ---------------------------------- |
| SDK setup, quickstart, library usage         | Context7 MCP                       |
| Endpoint catalogs, response fields           | Official docs (`WebFetch`)         |
| Effect runtime/library patterns              | Context7 (`effect-ts/effect-smol`) |
| Edge cases, community gotchas                | Targeted web search                |
| Ground truth of response body (REST/GraphQL) | VCR recording                      |
| Ground truth of response body (gRPC)         | Proto fixtures / mock server       |
| Architectural choice                         | Ask user                           |
