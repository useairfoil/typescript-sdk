# producer-template

A minimal, **buildable**, **CI-verified** Airfoil Connector Kit (ACK) connector template.
It targets [JSONPlaceholder](https://jsonplaceholder.typicode.com) (a free public
REST API) so the template can be compiled, typechecked, and tested without any
external credentials or sandbox setup.

Use it as the starting point for any new producer connector. See
[`.agents/skills/airfoil-kit/SKILL.md`](../../.agents/skills/airfoil-kit/SKILL.md)
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
- `sandbox.ts` runner using `NodeHttpServer` (or Bun equivalent), `FetchHttpClient`, an in-memory
  `StateStore`, a console `Publisher`, and optional OTLP telemetry.

## Files

```
src/
├── schemas.ts    - entity + webhook payload schemas (Effect Schema)
├── api.ts        - HttpClient-based API service
├── streams.ts    - backfill + live stream helpers
├── connector.ts  - defineConnector wiring + webhook route
├── sandbox.ts    - local dev runner (Node example, Bun-compatible)
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
5. Run `pnpm run lint && pnpm run typecheck && pnpm run build && pnpm run test:ci`
   from the repo root.

See [`.agents/skills/airfoil-kit/assets/rename-checklist.md`](../../.agents/skills/airfoil-kit/assets/rename-checklist.md)
for the exact search-and-replace list.

## Local development

```bash
cd templates/producer-template
cp .env.example .env
pnpm run sandbox  # starts the webhook server on :8080
```

## Scripts

- `pnpm run build` — bundle `src/` via `tsdown`.
- `pnpm run test` — vitest (the template tests do not require `.env`).
- `pnpm run test:ci` — vitest `run` mode.
- `pnpm run typecheck` — `tsc --noEmit`.
- `pnpm run sandbox` — local end-to-end runner.
