---
name: build-connector
description: Implement a new Airfoil producer connector end-to-end. Use when the user asks to build, add, scaffold, create, or port a connector/producer/integration for any SaaS API (Stripe, Shopify, GitHub, Intercom, HubSpot, Linear, Polar, custom, etc.) in this monorepo. Copies templates/producer-template/, researches the real API, wires Effect v4 Config + HttpClient + streams + WebhookRoute, and finishes with deterministic replay tests (VCR for REST/GraphQL, fixtures/mocks for gRPC).
---

# build-connector

You are implementing a new producer connector for the Airfoil Connector Kit (ACK)
inside this monorepo. Work in small, verified steps. Use the template as your
starting point, never guess API shapes, and keep changes aligned with the
existing patterns in `connectors/producer-polar/`.

---

## Hard rules (do not violate)

1. **Copy the template. Do not invent a new structure.** The canonical scaffold
   is `templates/producer-template/`. Start every new connector with
   `cp -R templates/producer-template connectors/producer-<name>` and adapt from
   there. See [`assets/rename-checklist.md`](./assets/rename-checklist.md).
2. **No pre-existing connector for the target service.** Before writing any
   code, run the pre-flight checks in [`references/anti-cheat.md`](./references/anti-cheat.md).
   If an implementation exists, stop and report it — do not copy, rename, or
   refactor it.
3. **Use Effect v4 only** (`effect@4.x`, `@effect/vitest@4.x`, `@effect/platform-*@4.x`).
   No legacy `@effect/platform`, `@effect/schema`, or Effect v2/v3 patterns.
   Read [`references/effect-v4-essentials.md`](./references/effect-v4-essentials.md)
   whenever you reach for a new Effect module.
4. **No `process.env` reads in connector code or tests.** Use
   `Config`/`ConfigProvider` everywhere. Sandbox/runtime layers attach
   `ConfigProvider.fromEnv()`; tests attach `ConfigProvider.fromUnknown({ ... })`
   or equivalent Effect config providers.
5. **Never edit cassette files by hand.** `test/__cassettes__/**` is write-only
   via record/replay flow. If replay mismatches, re-record or adjust matcher /
   redaction config — never patch cassette JSON directly.
6. **Schemas must be derived from real, observed API traffic.** For REST/GraphQL:
   record a VCR cassette against the real (sandbox) API and define `Schema.Struct`
   fields from the cassette. For gRPC: use deterministic proto fixtures or a mock
   server. Never hand-fabricate field names from memory. See
   [`references/vcr-workflow.md`](./references/vcr-workflow.md) and
   [`references/api-research.md`](./references/api-research.md).
7. **You must pass the implementation gate before writing connector code.**
   Before scaffolding or editing files under `connectors/producer-<name>/`,
   produce an API-facts artifact with: API mode (`rest`/`graphql`/`grpc`),
   source evidence URLs + access date, and a pinned API version rationale.
   Default artifact path: `connectors/producer-<name>/api-facts.md`.
   If the user requests non-persistence, keep it ephemeral but include the same
   facts in the final report.
8. **Webhook verification must follow platform docs exactly.** If the upstream
   service signs events, implement verification using the provider-documented
   contract (inputs, canonicalization, algorithm, encoding, tolerance). Use raw
   request bytes whenever the platform requires them. See
   [`references/webhooks.md`](./references/webhooks.md).
9. **Signed webhook verification must fail closed.** If signature verification
   is enabled and required verification inputs are missing (for example raw
   request bytes or signature headers), fail with a typed connector error.
   Never silently skip verification in this state.
10. **`test` and `test:ci` must load config equivalently.** If tests rely on
   env vars, both scripts must provide the same config-loading behavior
   (for example both loading `.env` through Bun flags).
11. **Pagination behavior must come from official platform docs.** Do not infer
    continuation semantics from memory or examples. Validate your implementation
    against recorded traffic and deterministic tests.
12. **Expected failures must use typed error channels.** Do not throw inside
    `Effect.sync` for recoverable connector errors. Map failures to
    `ConnectorError` (or connector-specific tagged errors mapped to it).
13. **The Definition of Done is a gate.** Do not declare complete until every
     item in [`references/definition-of-done.md`](./references/definition-of-done.md)
     passes (lint, typecheck, build, test:ci, and mode-appropriate deterministic
     replay: VCR for REST/GraphQL, fixtures or mock servers for gRPC).

---

## High-level flow

1. **Pre-flight** — confirm no existing implementation. → [`references/anti-cheat.md`](./references/anti-cheat.md)
2. **Archetype + mode** — classify the target API (sandbox URL? test keys?
   OAuth? webhook-only? polling-only?) and choose one implementation mode:
   `rest`, `graphql`, or `grpc`. →
   [`references/connector-archetypes.md`](./references/connector-archetypes.md)
3. **API research + evidence** — collect real endpoint + auth + pagination +
   webhook docs and write an API-facts artifact (required during implementation).
   Default path is `connectors/producer-<name>/api-facts.md`; if user asks not
   to persist it, keep the same facts in ephemeral notes and final report.
   Include source URLs, access date, selected version, and why.
   → [`references/api-research.md`](./references/api-research.md)
4. **Mode-specific standards** — read the one mode doc you selected and treat
   it as the implementation contract. Keep decisions evidence-based, and adapt
   abstractions to the target platform rather than copying one provider's shape.
5. **Credentials / test data** — ask the user for sandbox credentials and
   seed data; set up `.env`. → [`references/test-data.md`](./references/test-data.md)
6. **Scaffold** — `cp -R templates/producer-template connectors/producer-<name>`
   and run the rename checklist. → [`assets/rename-checklist.md`](./assets/rename-checklist.md)
   and [`references/template-walkthrough.md`](./references/template-walkthrough.md)
7. **Implement API client (mode-specific)** — use your selected mode contract
   and validate auth + pagination behavior against real docs and captured
   traffic. Also cross-check kit contracts in
   [`references/connector-kit-api.md`](./references/connector-kit-api.md).
8. **Define schemas from real traffic** — use mode-appropriate evidence:
   - REST/GraphQL: record a cassette in `record` mode, then derive
     `Schema.Struct` fields from observed responses.
   - gRPC: use deterministic proto fixtures and/or mock server outputs.
   → [`references/vcr-workflow.md`](./references/vcr-workflow.md),
   [`references/api-mode-grpc.md`](./references/api-mode-grpc.md)
9. **Wire entities + streams + webhook route** — follow the template's
   `makeEntityStreams` / `defineConnector` / `WebhookRoute` pattern. Add
   webhook signature verification if the service signs events. →
   [`references/patterns.md`](./references/patterns.md),
   [`references/webhooks.md`](./references/webhooks.md)
10. **Update the sandbox runner** — rename config names and port, keep the
   telemetry + console publisher boilerplate.
11. **Write tests** —
    - REST/GraphQL: `api.vcr.test.ts` replays the backfill path.
    - gRPC: deterministic fixture/mock-server tests cover equivalent paths.
    - `webhook.test.ts` exercises webhook endpoint behavior in-memory.
    Switch to replay mode (or fixture-only deterministic mode) before
    committing.
12. **Run the CI gate locally** — `bun run lint && bun run typecheck && bun run build && bun run test:ci`.
    Every one must pass. → [`references/definition-of-done.md`](./references/definition-of-done.md)

A detailed, numbered version of this flow lives at
[`references/playbook.md`](./references/playbook.md). Read it on every run.

---

## Files you will almost always need to edit

After `cp -R templates/producer-template connectors/producer-<name>`:

- `package.json` — rename, bump version, add service SDK / crypto deps.
- `.env.example` — rename env vars, list required sandbox credentials.
- `src/schemas.ts` — replace `PostSchema` with real entities.
- `src/api.ts` — replace `/posts` endpoint, adjust pagination + auth.
- `src/streams.ts` — keep the shape, adjust `cursorField`, cutoff logic.
- `src/connector.ts` — rename service tags, wire entities, implement webhook
  signature verification, rename `TEMPLATE_*` env vars.
- `src/sandbox.ts` — rename env vars and service name for logging + telemetry.
- `src/index.ts` — update exports.
- `test/api.vcr.test.ts` — REST/GraphQL replay test from real recorded cassette.
- `test/__fixtures__/**` and/or gRPC mock-server tests — gRPC deterministic
  replay artifacts.
- `test/webhook.test.ts` — adjust payload fixtures.
- `README.md` — describe the connector, required env, and test flow.

[`references/template-walkthrough.md`](./references/template-walkthrough.md)
explains each file line-by-line.

---

## When stuck

- For "what does this Effect symbol do?" → [`references/effect-v4-essentials.md`](./references/effect-v4-essentials.md).
- For GraphQL-mode implementation details → [`references/api-mode-graphql.md`](./references/api-mode-graphql.md).
- For gRPC-mode implementation details → [`references/api-mode-grpc.md`](./references/api-mode-grpc.md).
- For "what exports does the kit give me?" → [`references/connector-kit-api.md`](./references/connector-kit-api.md)
  and [`references/effect-http-client-api.md`](./references/effect-http-client-api.md).
- For "how did the Polar connector solve X?" → [`references/example-producer-polar.md`](./references/example-producer-polar.md).
- If truly blocked by missing API facts → **ask the user** (sandbox URL, test
  key format, webhook header name, pagination style). Never guess.

## If MCP tools are unavailable

Do not block on Context7/DeepWiki availability.

Fallback order:

1. Local repo source of truth:
   - `AGENTS.md`
   - `packages/connector-kit/src/**`
   - `packages/effect-http-client/src/**`
   - `connectors/producer-polar/**`
   - `templates/producer-template/**`
2. Official public docs via normal web fetch/search.
3. Ask the user only for missing, material facts (credentials, webhook
   signing details, v1 scope).

---

## Output expectations

- Small, additive commits. Minimize edits outside
  `connectors/producer-<name>/`; if cross-package changes are needed, keep them
  narrowly scoped and explicitly justify why.
- All generated code must typecheck, lint, and build.
- Final message must summarize: entities delivered, deterministic test evidence
  recorded (VCR or fixtures/mocks), commands you ran, and any follow-ups.
- Final message must include an **Environment Setup Guide** for the user:
  where each env var is obtained, required scopes/permissions, exact setup
  steps, and a quick "verify config" checklist.

Use this output shape:

1. `ENV_VAR_NAME`
2. Where to obtain it (dashboard/API flow + link/path)
3. Required scope/permission
4. Setup step (`cp .env.example .env`, paste value)
5. Verification command and expected signal
