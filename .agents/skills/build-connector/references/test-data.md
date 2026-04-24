# test-data

How to source realistic test data for a new connector, what to commit,
and what coverage is expected before declaring done.

## Reporting state when credentials are missing

When credentials or platform access are unavailable, report status using
`definition-of-done.md` completion states:

- `Code Complete`: allowed while waiting on credentials.
- `Verified with Real Cassettes`: not allowed until recordings exist.
- `CI Complete`: only after root CI baseline passes.

Do not collapse these into a binary done/not-done label.

## Credentials: asking and handling

1. **Ask the user explicitly.** Before recording any cassette, say:

   > I need <service> sandbox (or test-mode) credentials to record VCR
   > cassettes. Do you have:
   > - A test/sandbox API key? (preferred)
   > - A production API key with read-only scope? (acceptable)
   > - Access to a seeding MCP (e.g. Stripe MCP)? (ideal)

2. **Store creds in `.env`** at the connector package root. Example:

   ```
   STRIPE_API_KEY=sk_test_xxxxxxxxxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
   ```

3. **Never commit `.env`.** Confirm the connector's `.gitignore` or the
   repo root `.gitignore` excludes it.

4. **Always commit `.env.example`** with placeholder values and a comment
   per variable:

   ```
   # Stripe test-mode API key (starts with sk_test_)
   STRIPE_API_KEY=

   # Stripe webhook signing secret from the dashboard (starts with whsec_)
   STRIPE_WEBHOOK_SECRET=
   ```

5. **Redact credentials in cassettes.** Authorization header is redacted
   by default; extend `redact.requestHeaders` for any other auth header
   the service uses. See `vcr-workflow.md`.

6. **Never edit cassette JSON by hand.** If sensitive fields leak or replay
   mismatches occur, update redaction/matching and re-record.

## Seeding test data

Order of preference:

1. **Target-service MCP** (e.g., Stripe MCP). Ask the user if one is
   available and configured. MCPs can deterministically seed a sandbox
   with specific fixtures, making recordings reproducible.

2. **Sandbox seed scripts** that the platform provides. Many SaaS
   offerings have "populate my test account" helpers; document the exact
   steps in the connector README.

3. **Manual dashboard seeding** — create a handful of records by hand
   through the service's UI. Document the minimum set.

4. **Live read-only fetch**. If the user has a real account with data,
   record against it (with redaction). Take special care:
   - Redact emails, PII, tenant identifiers.
   - Review the cassette diff before committing.

## Required coverage per entity

For gRPC mode, replace `test/api.vcr.test.ts` with deterministic fixture or
mock-server tests. The coverage categories below still apply.

For each entity the connector ships:

| Coverage | Required? | Test file |
| --- | --- | --- |
| Backfill: list page 1 | yes | `test/api.vcr.test.ts` |
| Backfill: list with pagination (page 2+) | yes if API paginates | `test/api.vcr.test.ts` |
| Empty page / end-of-data | recommended | `test/api.vcr.test.ts` |
| Detail fetch (one `GET /thing/:id`) | yes if used by dispatch | `test/api.vcr.test.ts` |
| Webhook: one payload per dispatched event type | yes | `test/webhook.test.ts` |
| Webhook: signature verification success | yes | `test/webhook.test.ts` |
| Webhook: signature verification failure | yes | `test/webhook.test.ts` |
| Auth failure (401) | recommended | separate test or inline |

## Webhook payloads

Webhook tests don't capture cassettes — they drive in-process `POST`s
against `NodeHttpServer.layerTest`. The payloads themselves come from:

1. **Platform dashboards** — most SaaS providers let you trigger a test
   webhook from their UI and inspect the payload.
2. **Platform CLI tools** — e.g. `stripe trigger customer.created`.
3. **Official docs** — paste in the documented example payload.

Copy the **verbatim** payload into a fixture file or inline string in
the test. Treat it as ground truth (same principle as VCR).

## Fixture files

If a test needs a large payload, place it at
`test/__fixtures__/<name>.json` and import via
`fs.readFileSync` in Node or via Bun's `import ... with { type: "json" }`.
Prefer tiny inline fixtures for common cases.

## Test data hygiene

- **Stable IDs.** Use short, non-PII strings (e.g., `user_123`). Avoid
  UUIDs from the real platform when possible — they look real and
  obscure intent.
- **Deterministic timestamps.** ISO-8601 strings like
  `"2024-01-01T00:00:00Z"` keep diffs clean.
- **No emails, phone numbers, or addresses.** Use
  `test+<n>@example.com`, `+15550000000`, etc.

## Commit what, exactly

Commit:

- `test/__cassettes__/*.cassette` (JSON, human-diffable).
- `test/__fixtures__/**` if used.
- `.env.example`.

Do not commit:

- `.env`.
- `node_modules/`.
- Any file containing actual API keys, customer emails, or internal
  tenant identifiers.

## Running tests locally vs CI

Local (record or replay):

```bash
bun run --cwd connectors/producer-<name> test
```

CI (`CI=true`):

```bash
bun run --cwd connectors/producer-<name> test:ci
```

`test:ci` sets `CI=true` implicitly (some packages set it in their
script). In VCR `auto` mode, missing cassettes fail fast in CI instead
of recording.

`test` and `test:ci` must load config equivalently. If one uses
`bun --env-file=.env`, the other must too (unless tests only use
`ConfigProvider.fromUnknown`).

## When tests can't be recorded at all

Some APIs forbid programmatic access without paid accounts. In that case:

1. Surface to the user and request an explicit waiver.
2. Default outcome is **pause** (do not mark connector done without VCR
   evidence for shipped entities).
3. If the user explicitly accepts a temporary exception, document:
   - uncovered entities/endpoints,
   - why recording is impossible right now,
   - exact follow-up needed to record and validate.
4. Add a TODO with a tracking link in the deterministic replay test file:
   - REST/GraphQL: `TODO(vcr)` in `test/api.vcr.test.ts`.
   - gRPC: `TODO(fixtures)` in fixture/mock-server test file.

Do not ship a connector with fabricated schemas silently.

In this situation, final reporting must explicitly say:

- current completion state (`Code Complete` only),
- what is blocked by credentials,
- exact action required to reach `Verified with Real Cassettes`.

## Final report env setup guide (required)

Final report must include a short setup guide the user can apply immediately:

1. Each required env var.
2. Where to obtain it (dashboard page / API flow link).
3. Required scopes/permissions.
4. Exact setup steps (`cp .env.example .env`, fill values, run sandbox/test).
5. Quick verification commands (`test:ci`, `sandbox`, `/health`).
