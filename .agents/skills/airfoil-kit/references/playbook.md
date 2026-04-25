# Playbook: building a new producer connector

End-to-end flow, expanded from `SKILL.md`. Follow in order; do not skip steps.

---

## 0. Confirm intent

Before touching the repo, restate what you will build:

- Target service (e.g. Stripe).
- Entities to ingest (e.g. `customers`, `charges`, `subscriptions`).
- Event types to process (if any).
- Does the service sign webhooks? What header?
- Does the service have a sandbox/test-mode? What base URL? What credentials?

If anything is unclear, **ask the user**. Do not guess.

## 1. Anti-cheat pre-flight

Run the checks in [`anti-cheat.md`](./anti-cheat.md). Abort and report if any
existing connector code for this service is found.

## 2. Classify the API archetype

Identify which of the archetypes in [`connector-archetypes.md`](./connector-archetypes.md)
matches. This tells you what config knobs to expose and what stream shape to
use (webhook-first vs polling-only, single-tenant vs multi-tenant).

Also choose one implementation mode for this connector:

- `rest` (default for JSON HTTP APIs)
- `graphql`
- `grpc`

Do not start implementation until this mode is explicit in `api-facts.md`.

## 3. API research

Follow [`api-research.md`](./api-research.md) to collect:

- Base URL (sandbox + prod).
- Auth scheme (Bearer, API key header, Basic, OAuth2).
- Required scopes / API version headers.
- Pagination style (see [`example-pagination.md`](./example-pagination.md)).
- List + detail endpoint shapes for each entity.
- Webhook event catalog and signature algorithm.

Write an API-facts artifact during this step (required before coding),
including:

- selected mode (`rest`/`graphql`/`grpc`),
- source evidence URLs + retrieval date,
- chosen API version and rationale,
- auth, pagination, and webhook contracts.

Default path is `connectors/producer-<service>/api-facts.md`. If the user asks
not to persist this file, keep equivalent facts in notes and include them in
the final report.

Use Context7 for Effect-specific v4 docs (`effect-ts/effect-smol`) and
service SDK docs, and `WebFetch` for public API reference pages. DeepWiki
is optional fallback. Capture everything you learn in a short notes file
or in the PR description so nothing is lost.

## 4. Read mode-specific contract

- REST: [`patterns.md`](./patterns.md), [`example-auth.md`](./example-auth.md),
  [`example-pagination.md`](./example-pagination.md)
- GraphQL: [`api-mode-graphql.md`](./api-mode-graphql.md)
- gRPC: [`api-mode-grpc.md`](./api-mode-grpc.md)

Treat your selected mode doc as implementation contract.

## 5. Credentials + test data

See [`test-data.md`](./test-data.md).

- Ask the user for a sandbox API key (and webhook secret if webhooks are
  signed).
- Seed the sandbox with representative data (`mcp`, UI, or curl scripts).
- Write `.env.example` listing every env var the connector reads.
- Copy `.env.example` to `.env` locally (the user should fill in real values).

## 6. Scaffold from the template

```bash
cp -R templates/producer-template connectors/producer-<service>
cd connectors/producer-<service>
```

Run the search-and-replace pass from [`assets/rename-checklist.md`](../assets/rename-checklist.md).
Verify the new package installs:

```bash
cd ../..                # back to repo root
pnpm install
pnpm --filter @useairfoil/producer-<service> run typecheck
```

## 7. Implement the API client (`src/api.ts`)

Use your selected mode contract:

- **REST:** implement auth, endpoint paths, and pagination in `fetchList`
  based on researched docs and recorded traffic (see
  [`example-auth.md`](./example-auth.md) and
  [`example-pagination.md`](./example-pagination.md)).
- **GraphQL:** implement the request helper, envelope decode, `errors` branch,
  and pagination mapping per [`api-mode-graphql.md`](./api-mode-graphql.md).
  Create `src/graphql/operations.ts` for query constants.
- **gRPC:** generate client stubs via `buf generate`, build the `XGrpcApiClient`
  service layer, and centralize deadlines/auth/retry per
  [`api-mode-grpc.md`](./api-mode-grpc.md).

For all modes: keep recoverable runtime failures in typed error channels.
Map transport/decode/contract failures to `ConnectorError` (or a connector-
specific tagged error mapped to it).

## 8. Define schemas from recorded traffic (`src/schemas.ts`)

For REST/GraphQL mode:

1. Set one test's VCR `mode: "record"`, drop the real sandbox token into
   `.env`, and run `pnpm run test`. This records the cassette against the
   real API.
2. Open the cassette (`test/__cassettes__/<file>.cassette`) and read the
   actual response body.
3. Translate the observed JSON to `Schema.Struct({...})`. Use `Schema.NullOr`
   for nullable fields, `Schema.Array` for arrays, `Schema.Literals([...])`
   for enums, `Schema.Record(Schema.String, Schema.Any)` for free-form maps.
4. Flip `mode: "replay"` before committing. See [`vcr-workflow.md`](./vcr-workflow.md).

For gRPC mode:

1. VCR HTTP cassettes do not apply.
2. Use deterministic proto fixtures and/or mock gRPC servers.
3. Derive schemas/contracts from recorded fixture payloads and generated types.

Repeat per entity + per webhook event type. Union webhook payload variants
the same way `producer-polar` does — see
[`example-producer-polar.md`](./example-producer-polar.md).

## 9. Wire entities and streams (`src/streams.ts`, `src/connector.ts`)

- For each entity, call `makeEntityStreams({ api, schema, path, cursorField, limit })`.
- `cursorField` should be a monotonically increasing server-emitted timestamp
  (or numeric id) that appears on every row.
- Register each entity with `defineEntity({ name, schema, primaryKey, live, backfill })`.
- If the service also emits append-only events (e.g. audit logs), use
  `defineEvent` instead. Events backfill first, then go live.
- Compose into `defineConnector({ name, entities, events })`. See
  [`connector-kit-api.md`](./connector-kit-api.md) and [`patterns.md`](./patterns.md).

## 10. Webhook route (`src/connector.ts`)

- Define one `WebhookRoute<WebhookPayload>` per inbound path the service
  uses (often just one).
- Verify signatures against `rawBody` using the documented HMAC or library
  helper. See [`webhooks.md`](./webhooks.md) and
  [`example-webhook-verification.md`](./example-webhook-verification.md).
- If signature verification is enabled, treat missing verification inputs
  (for example `rawBody` or signature header) as explicit failures. Do not
  silently bypass verification in this state.
- In the `handle` function, switch on `payload.type` and dispatch to the
  right entity queue via `dispatchEntityWebhook`.

## 11. Sandbox runner (`src/sandbox.ts`)

- Rename service identifiers in logs and telemetry.
- Rename env vars (`TEMPLATE_WEBHOOK_PORT` → `<SERVICE>_WEBHOOK_PORT`).
- Keep the telemetry layer as-is; callers can enable it via `ACK_TELEMETRY_ENABLED`.
- Required layer checklist: `HttpClient`, `ConfigProvider`, `StateStore`,
  `Publisher`, and server layer.
- Run once and confirm startup reaches webhook server ready/health output.

## 12. Tests (`test/*`)

- REST/GraphQL: `api.vcr.test.ts` record once, commit the cassette, then
  replay. Cover at least one list endpoint + a documented pagination
  transition for the target platform.
- gRPC: use deterministic proto fixtures and/or mock gRPC servers; do not rely
  on HTTP VCR cassettes for gRPC traffic.
- `webhook.test.ts`: use `NodeHttpServer.layerTest` (or Bun equivalent test layer)
  to POST a sample payload
  and assert the publisher received one batch with the expected entity name.
- If signed webhooks are used, include both valid-signature and
  invalid-signature test paths.
- Include one no-op/ignored webhook event path to confirm unknown or
  unsupported events do not publish side effects.
- Optional: a second replay/fixture test for a second entity or cutoff
  boundary.
- Ensure `test` and `test:ci` load configuration equivalently.

## 13. README

- Document install, required env, sandbox command, recording/replay flow (or
  fixture flow for gRPC), and test commands.
- Satisfy the full README checklist in [`definition-of-done.md`](./definition-of-done.md)
  instead of mirroring any single connector README.

## 14. Local CI gate

Run each of these from the repo root. Every one must pass:

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test:ci
```

If any fail, fix before proceeding. See [`definition-of-done.md`](./definition-of-done.md).

## 15. Report back

Final message should list:

- Entities + events delivered.
- Endpoints/operations exercised under deterministic replay (VCR or fixtures).
- Commands you ran and their outcomes.
- Completion state (`Code Complete`, `Verified with Real Cassettes`, or
  `CI Complete`).
- Known follow-ups (e.g. pagination patterns you could not record yet).
- Environment setup guide with, for each env var:
  1. where to obtain it,
  2. required scopes/permissions,
  3. exact setup steps (`cp .env.example .env`, fill values),
  4. verification command + expected signal.
- Any questions for the user.
