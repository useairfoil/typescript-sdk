# producer-template

A minimal, **buildable**, **CI-verified** Airfoil Connector Kit (ACK) connector template.
It targets [JSONPlaceholder](https://jsonplaceholder.typicode.com) (a free public
REST API) so the template can be compiled, typechecked, and tested without any
external credentials or sandbox setup.

Use it as the starting point for any new producer connector. See
[`.agents/skills/build-connector/SKILL.md`](../../.agents/skills/build-connector/SKILL.md)
for the end-to-end playbook.

---

## What this template demonstrates

- `defineConnector` with a single entity (`posts`).
- `defineEntity` with a paginated backfill stream and a live webhook stream.
- A small Effect `HttpClient`-based API client (bearer-token stubbed).
- Effect v4 `Config` composition for credentials, base URL, webhook port,
  and webhook secret (optional).
- A `WebhookRoute` with `Schema`-validated payload and optional raw-body
  signature verification hook.
- VCR tests: one recorded cassette for the backfill happy path + one in-memory
  webhook test using `NodeHttpServer.layerTest`.
- `sandbox.ts` runner using `BunHttpServer`, `FetchHttpClient`, an in-memory
  `StateStore`, a console `Publisher`, and optional OTLP telemetry.

## Files

```
src/
├── schemas.ts    - entity + webhook payload schemas (Effect Schema)
├── api.ts        - HttpClient-based API service
├── streams.ts    - backfill + live stream helpers
├── connector.ts  - defineConnector wiring + webhook route
├── sandbox.ts    - local dev runner (Bun + console publisher)
└── index.ts      - public exports

test/
├── helpers.ts           - test publisher layer
├── api.vcr.test.ts      - VCR replay of the backfill path
└── webhook.test.ts      - in-memory webhook round trip
```

## Using the template

This package is meant to be **copied**, not installed. The agent workflow is:

1. `cp -R templates/producer-template connectors/producer-<your-service>`
2. Replace `TEMPLATE_` / `template` identifiers with your service name.
3. Replace the JSONPlaceholder endpoint / schemas with real API calls.
4. Re-record VCR cassettes against the real sandbox.
5. Run `bun run lint && bun run typecheck && bun run build && bun run test:ci`
   inside the new connector directory.

See [`.agents/skills/build-connector/assets/rename-checklist.md`](../../.agents/skills/build-connector/assets/rename-checklist.md)
for the exact search-and-replace list.

## Local development

```bash
cd templates/producer-template
cp .env.example .env
bun run sandbox  # starts the webhook server on :8080
```

## Scripts

- `bun run build` — bundle `src/` via `tsdown`.
- `bun run test` — vitest with `.env` loaded.
- `bun run test:ci` — vitest `run` mode, used by Turborepo.
- `bun run typecheck` — `tsc --noEmit`.
- `bun run lint` / `bun run lint:fix` — biome.
- `bun run sandbox` — local end-to-end runner.
