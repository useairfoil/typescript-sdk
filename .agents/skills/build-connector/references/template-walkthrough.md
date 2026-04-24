# template-walkthrough

File-by-file tour of `templates/producer-template/`. The template targets
[JSONPlaceholder](https://jsonplaceholder.typicode.com) so the code runs and
tests pass with zero credentials. Every file below has a "what to change"
section for when you port it to a real API.

---

## `package.json`

Minimal workspace package. Key points:

- `"name": "@useairfoil/producer-template"` — rename to
  `@useairfoil/producer-<service>`.
- `"private": true` — keep private unless explicitly publishing.
- `"type": "module"` — all packages in this repo are ESM.
- `"exports"` — points `.` to `dist/index.js` and `dist/index.d.ts`.
- `dependencies.effect: "4.0.0-beta.25"` — pin Effect v4. Must match other
  packages in the repo.
- `devDependencies['@useairfoil/effect-http-client']` — VCR lives in a devDep
  so it does not leak into the published bundle.

**What to change:** `name`, `version`, and any service-specific dependencies
(e.g. `stripe`, `@octokit/rest`, `shopify-api-node`). Do **not** change the
Effect, `@effect/platform-*`, or `@effect/vitest` versions — they are pinned
at the monorepo level.

## `tsconfig.json`

Extends the repo root tsconfig. `strict: true`, `verbatimModuleSyntax: true`,
`noEmit: true` (the build runs through tsdown).

**What to change:** nothing.

## `tsdown.config.ts`

Single entry (`src/index.ts`) bundled as ESM with `.d.ts` output. Same as
every other package in the repo.

**What to change:** nothing.

## `vitest.config.ts`

`fileParallelism: false` (VCR tests share cassette files, don't race them),
60s timeout for network recording.

**What to change:** nothing.

## `.env.example`

Template env surface. Every variable the connector reads from `Config` should
appear here with a stubbed value.

**What to change:** replace `TEMPLATE_*` with `<SERVICE>_*` and add real
variables — API key, webhook secret, tenant id, etc.

## `src/schemas.ts`

Effect `Schema.Struct` for the `Post` entity + a `WebhookPayloadSchema` union
of two event shapes (`post.created|post.updated` and an ignored `post.deleted`).

**What to change:** replace `PostSchema` with the real entity schemas and
`WebhookPayloadSchema` with the real event union. Always derive fields from a
recorded cassette — see [`vcr-workflow.md`](./vcr-workflow.md).

## `src/api.ts`

Defines:

- `TemplateApiClientService` — the typed service surface (`fetchJson`,
  `fetchList`).
- `TemplateApiClient` — `ServiceMap.Service` tag.
- `makeTemplateApiClient` — Effect factory that obtains an `HttpClient`,
  prepends the base URL, attaches `bearerToken`, and returns typed helpers.
- `TemplateApiClientConfig` — `Layer.effect(...)` wrapper for composition.

**What to change:**

- Auth middleware on `HttpClient.mapRequest(...)` — Bearer by default, swap
  to `setHeader`, `basicAuth`, OAuth2 refresh layer as needed. See
  [`example-auth.md`](./example-auth.md).
- Pagination style in `fetchList`. JSONPlaceholder uses `_page`/`_limit`;
  your API may use `cursor`, `page_size`, `starting_after`, link headers, etc.
  See [`example-pagination.md`](./example-pagination.md).
- Endpoint paths — `/posts` → your real list endpoints.
- Error mapping — keep mapping into `ConnectorError`, but add service-specific
  error enrichment where useful.

## `src/streams.ts`

Entity-stream factory:

- `resolveCursor(row, field)` turns a row's cursor field into a `Cursor`.
- `dispatchEntityWebhook({ queue, cutoff, row, cursor })` — enqueue + set
  cutoff in one go.
- `makeBackfillStream(...)` — waits on the cutoff deferred, then uses
  `makePullStream` to page until `hasMore` is false. Filters to
  `row[cursorField] <= cutoff`.
- `makeEntityStreams(...)` — one-shot factory returning `{ live, cutoff, backfill }`.

**What to change:**

- `isOnOrBeforeCutoff` — tweak the cutoff comparison if your cursor is a
  timestamp (`new Date(...)`) vs a numeric id. For timestamps, prefer the
  Polar connector's string-compare (`new Date(value).getTime()`).
- Pagination hand-off. The JSONPlaceholder example paginates by incrementing
  `_page`. For cursor-based APIs, return `cursor: next_token` and rely on the
  API's own `hasMore`/`has_more` flag.
- `limit` default (10 for JSONPlaceholder; 100 is a good default for real APIs).

## `src/connector.ts`

The main wire-up file:

- `TemplateConfig` — plain type describing the decoded config struct.
- `TemplateConfigConfig` — `Config.all({...})` that decodes env vars.
- `TemplateConnector` — `ServiceMap.Service` exposing
  `{ connector, routes }` to callers.
- `verifyWebhookSignature` — **stub**. Replace with real HMAC verification.
- `resolveWebhookDispatch` — switch on `payload.type`, dispatch to the right
  entity queue.
- `makeTemplateConnector` — builds `EntityStreams` and composes everything.
- `TemplateConnectorConfig` — `Layer.effect(TemplateConnector)(...)` for
  runtime composition.

**What to change:**

- Rename every `Template` / `TEMPLATE_` identifier. See
  [`assets/rename-checklist.md`](../assets/rename-checklist.md).
- Implement real webhook signature verification. Use the service's SDK
  helper where available (e.g. `stripe.webhooks.constructEvent`,
  `@polar-sh/sdk/webhooks.validateEvent`). See [`webhooks.md`](./webhooks.md).
- Add one `makeEntityStreams` call per entity.
- Add one `WebhookRoute` per inbound path.
- Extend `resolveWebhookDispatch` with cases for every event type you care
  about. Ignored events should fall into a `.void`/`.asVoid` case to keep
  them explicit.

## `src/sandbox.ts`

End-to-end runner for local development:

- `SandboxConfig`, `TelemetryConfig` — Effect `Config.all({...})` for runtime
  knobs.
- `ConsolePublisherLayer` — a `Publisher` that logs batches instead of
  pushing them to Wings.
- `program` — obtains the connector + routes, starts a `BunHttpServer`, and
  calls `runConnector(connector, { initialCutoff, webhook: { routes } })`.
- `EnvLayer` — merges `FetchHttpClient.layer` and
  `ConfigProvider.fromEnv()`.
- `TelemetryLayer` — opt-in OTLP export + runtime metrics.
- `RuntimeLayer` — composes every layer the program needs.
- Final `Effect.runPromise(...)` with a fatal error logger.

**What to change:** only identifiers (`TEMPLATE_*` → `<SERVICE>_*`,
`producer-template` → `producer-<service>`), never the layer structure.

## `src/index.ts`

Re-exports the public API. Keep the shape small: service tag, config
factory, config struct type, runtime type, and schemas you want consumers
to pattern-match against.

## `test/helpers.ts`

Test-only `Publisher` that captures every published batch into a `Ref` and
resolves a `Deferred` after N batches land. Used by every webhook test.

**What to change:** nothing.

## `test/api.vcr.test.ts`

VCR replay test. Construction order:

1. Build `program` that uses `TemplateApiClient` directly.
2. Build an `apiLayer` that supplies `TemplateApiClient` from
   `makeTemplateApiClient`.
3. Build a `cassetteLayer` from `CassetteStoreLive` + `NodeFileSystem.layer`.
4. Build a `vcrLayer` from `VcrHttpClientLayer({ connectorName, mode })` with
   `NodeHttpClient.layerFetch` underneath.
5. Provide everything + a `ConfigProvider.fromUnknown({ ... })` with the
   minimum env needed for `TemplateConfigConfig` to decode.

The first time you run this against a real API, set `mode: "record"`. After
the cassette is written, switch to `"replay"` and commit.

## `test/webhook.test.ts`

In-memory webhook test using `NodeHttpServer.layerTest`:

1. Build a test publisher via `makeTestPublisher(1)`.
2. Fork `runConnector(connector, { webhook: { routes } })`.
3. POST a synthetic payload to the webhook path via `HttpClient.execute`.
4. Wait on `Deferred.await(done)`; assert one batch was published to the
   right entity name.

**What to change:** the fixture payload object, the webhook path, and the
expected entity name.

## `test/__cassettes__/`

JSON cassette files, committed. One per `*.vcr.test.ts`, keyed by the Vitest
test name. See [`vcr-workflow.md`](./vcr-workflow.md) for the file format.

## `README.md`

Document the connector. Mirror the structure of
`connectors/producer-polar/README.md`: Install → Env → Minimal wiring →
Architecture → Testing with VCR.

---

## Where the template intentionally differs from Polar

- Only one entity (`posts`), no `events`.
- Numeric cursor (`id`) instead of a timestamp, because JSONPlaceholder does
  not emit timestamps. Real connectors should prefer timestamps.
- No real webhook signing — the stub accepts everything. Polar delegates to
  `@polar-sh/sdk/webhooks.validateEvent`.
- No service SDK dependency. Real connectors usually add one.
- A simpler `TemplateListPage<A>` with `{ items, hasMore }` instead of
  `{ items, pagination: { total_count, max_page } }` since JSONPlaceholder
  has no totals.

When in doubt, compare the new connector against Polar:
[`example-producer-polar.md`](./example-producer-polar.md).
