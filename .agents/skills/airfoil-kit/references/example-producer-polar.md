# example-producer-polar

Kitchen-sink walkthrough of `connectors/producer-polar/`. This connector
exercises nearly every feature of the kit: four entities, real HMAC
verification, optional config values, the Deferred-cutoff handoff from
webhooks to backfill, a sandbox base URL, and a VCR test suite. Read
this after the template walkthrough to see "what good looks like" for a
real connector.

Everything you see here is source-of-truth code. Reference the actual
files instead of re-typing blocks.

## File inventory

```
connectors/producer-polar/
  src/
    api.ts          # 103 lines — PolarApiClient service + layer
    connector.ts    # 344 lines — PolarConfigConfig, webhook dispatch, runtime
    index.ts        #   8 lines — public re-exports
    sandbox.ts      # 132 lines — local runner with telemetry toggle
    schemas.ts      # 234 lines — four entity schemas + webhook payload union
    streams.ts      # 120 lines — makeEntityStreams, dispatch helpers
  test/
    api.vcr.test.ts    #  58 lines — per-entity replay tests
    helpers.ts         #  29 lines — test publisher
    webhook.test.ts    #  90 lines — end-to-end webhook dispatch test
    __cassettes__/     # committed recorded responses
  package.json, tsconfig.json, tsdown.config.ts, vitest.config.ts, README.md
```

## `src/connector.ts` — the centerpiece

```45:50:connectors/producer-polar/src/connector.ts
export class PolarConnector extends Context.Service<
  PolarConnector,
  PolarConnectorRuntime
>()("@useairfoil/producer-polar/PolarConnector") {}
```

- `PolarConnector` is the service tag. It holds the fully-assembled
  `{ connector, routes }` pair. Callers inject it into `runConnector`.

```52:59:connectors/producer-polar/src/connector.ts
export const PolarConfigConfig = Config.all({
  accessToken: Config.string("POLAR_ACCESS_TOKEN"),
  apiBaseUrl: Config.string("POLAR_API_BASE_URL").pipe(
    Config.withDefault("https://sandbox-api.polar.sh/v1/"),
  ),
  organizationId: Config.option(Config.string("POLAR_ORGANIZATION_ID")),
  webhookSecret: Config.option(Config.string("POLAR_WEBHOOK_SECRET")),
});
```

- `Config.all({...})` composes the four required/optional env vars.
- `Config.withDefault` points at the sandbox by default — this is the
  "sandbox archetype" (see `connector-archetypes.md`).
- `Config.option` lets the two optional fields be absent without
  failing decode.

```62:83:connectors/producer-polar/src/connector.ts
const verifyWebhookSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      validateEvent(
        Buffer.from(options.rawBody),
        options.headers,
        options.secret,
      );
    },
    catch: (error) =>
      new ConnectorError({
        message:
          error instanceof WebhookVerificationError
            ? "Invalid Polar webhook signature"
            : "Failed to validate Polar webhook",
        cause: error,
      }),
  });
```

- Uses Polar's official SDK (`@polar-sh/sdk/webhooks.validateEvent`)
  rather than rolling its own HMAC. Prefer official libs when the
  platform ships one.
- Maps ambient errors into a typed `ConnectorError` with a meaningful
  message.

```86:220:connectors/producer-polar/src/connector.ts
const resolveWebhookDispatch = (options: {
  readonly payload: WebhookPayload;
  readonly customers: EntityStreams<Customer>;
  ...
}) => {
  switch (payload.type) {
    case "checkout.created":
    case "checkout.updated":
    ...
  }
};
```

- Exhaustive switch over every webhook type documented by Polar.
- Event types that fan out to the same entity are merged (e.g., all
  `checkout.*` go to the `checkouts` stream).
- Types that Polar sends but we intentionally ignore (membership,
  refunds, products) fall through to `Effect.void`.
- Unknown types hit the default branch and emit `logWarning` — a
  deliberate trade-off: we don't fail on new webhook types, but we
  make them visible.

```223:321:connectors/producer-polar/src/connector.ts
const makePolarConnector = (config: PolarConfig) =>
  Effect.gen(function* () {
    const api = yield* PolarApiClient;
    const customerStreams = yield* makeEntityStreams({ api, schema: CustomerSchema, path: "customers/", cursorField: "created_at" });
    // ... three more entity streams
    const connector = defineConnector({
      name: "producer-polar",
      entities: [ defineEntity({...}), ... ],
      events: [],
    });
    const webhookRoute: WebhookRoute<WebhookPayload> = {
      path: "/webhooks/polar",
      schema: WebhookPayloadSchema,
      handle: (payload, request, rawBody) =>
        Effect.gen(function* () {
          if (Option.isSome(config.webhookSecret) && rawBody) {
            yield* verifyWebhookSignature({...});
          }
          yield* resolveWebhookDispatch({...});
        }),
    };
    return { connector, routes: [webhookRoute] };
  });
```

- Four entities, each wired through `makeEntityStreams`.
- `cursorField: "created_at"` is Polar's monotonically-increasing field.
- A single webhook route handles all four entities.
- `Option.isSome(config.webhookSecret) && rawBody` gates verification —
  missing secret in dev is a warn, not an error.

```323:344:connectors/producer-polar/src/connector.ts
export const PolarConnectorConfig = (): Layer.Layer<
  PolarConnector,
  ConnectorError,
  HttpClient.HttpClient
> =>
  Layer.effect(PolarConnector)(
    Effect.gen(function* () {
      const config = yield* PolarConfigConfig;
      return yield* makePolarConnector(config).pipe(
        Effect.provide(PolarApiClientConfig(config)),
      );
    }).pipe(
      Effect.mapError((error) =>
        error instanceof ConnectorError
          ? error
          : new ConnectorError({ message: "Polar config failed", cause: error }),
      ),
    ),
  );
```

- The public layer factory. Reads config, builds the API client layer
  on the fly, produces the runtime.
- Narrows the error channel to `ConnectorError`.
- Requires `HttpClient.HttpClient` — callers supply this via
  `FetchHttpClient.layer` or `VcrHttpClient.layer(...).pipe(Layer.provide(FetchHttpClient.layer))`.

## `src/api.ts` — HTTP layer

The shape is exactly the pattern described in `patterns.md` §4:

- `PolarApiClient` service tag.
- `fetchJson(schema, path, params?)` for single-resource fetches.
- `fetchList(schema, path, options)` for paginated lists — Polar uses
  `page`/`limit` query params and returns `{ items, pagination }`.
- Base URL + bearer header are baked into the `HttpClient` via
  `HttpClient.mapRequest(HttpClientRequest.prependUrl(...))` +
  `HttpClientRequest.bearerToken(accessToken)`.
- `PolarApiClientConfig(config)` factory layer provides the service,
  requiring `HttpClient.HttpClient` from below.

Use this as the template for any bearer-token + page+limit API.

## `src/schemas.ts` — data shapes

- Four `Schema.Struct` definitions (Customer, Checkout, Subscription,
  Order).
- A `WebhookPayloadSchema = Schema.Union([...])` that tags each payload
  variant with its literal `type`.
- Ignored event types appear in a second `Schema.Struct` with
  `type: Schema.Literal(...)` and an open `data: Schema.Any` — this
  lets decode succeed so the connector can log+skip rather than crash.

Patterns to steal:

- Optional fields wrapped with `Schema.NullOr(...)` when the API returns
  `null` for empty values.
- Timestamp fields typed as `Schema.String` (ISO-8601) rather than
  `Schema.Date`, because the cursor is a string.

## `src/streams.ts` — stream wiring

- `resolveCursor(row, field)` extracts the cursor value from a row.
- `setCutoff(deferred, cursor)` is idempotent — safe to call on every
  incoming webhook.
- `dispatchEntityWebhook({queue, cutoff, row, cursor})` sets the cutoff
  and enqueues.
- `makeBackfillStream(...)` wraps `makePullStream` with a cutoff filter.
- `makeEntityStreams(...)` creates the `{live, cutoff, backfill}` trio.

This file is almost entirely generic — 90% of it is reusable across
connectors (and is essentially what the template ships).

## `src/sandbox.ts` — local runner

- Reads `ACK_TELEMETRY_ENABLED` (via Effect Config) to toggle OTLP
  export. When enabled, composes
  `Observability.Otlp.layerJson(...) + Metric.enableRuntimeMetricsLayer`.
- Mounts `NodeHttpServer.layer(createServer, { port: webhookPort })`.
- Uses `StateStoreInMemory` + `ConsolePublisherLayer` for zero
  infrastructure — prints batches to stdout.
- Entry point: `Effect.runPromise(program.pipe(Effect.provide(RuntimeLayer)))`.

Copy this sandbox shape unchanged for any connector; only the
connector-specific layer (`PolarConnectorConfig` → `XConnectorConfig`)
and env-var name change.

## `test/api.vcr.test.ts` — replay tests

- One cassette covers all four list endpoints.
- Each test decodes the real response through the schema. If the schema
  drifts from the cassette, the test fails — this is the mechanism that
  keeps schemas honest.

## `test/webhook.test.ts` — end-to-end

- Uses `NodeHttpServer.layerTest` for an in-process HTTP transport.
- Forks `runConnector(...)` with `Effect.forkScoped`, so the webhook
  route is actually mounted.
- POSTs a realistic `customer.created` payload.
- Uses `makeTestPublisher` to capture the emitted batch, then asserts
  shape.

This is the template for every webhook test — the only thing that
changes is the payload fixture and the expected stream.

## `test/helpers.ts` — test publisher

- ~29 lines. Creates a `Publisher` layer that buffers batches into a
  `Ref` and resolves a `Deferred` after `expected` deliveries.
- Drop-in for any connector test.

## What NOT to copy verbatim

- `@polar-sh/sdk` dependency — Polar-specific.
- The four entity names / cursor fields — platform-specific.
- The list of ignored webhook types — this is the Polar event catalog.
- `POLAR_*` env var names.

## Anatomy summary

Polar demonstrates:

- Single-tenant sandbox-URL archetype.
- Bearer token auth.
- Page+limit pagination.
- Webhook-driven live + API-driven backfill.
- Cutoff-deferred handoff.
- Optional signing secret with friendly warning.
- Telemetry wiring toggled by one env var.
- VCR replay tests + in-process webhook tests.

If you're building a connector that matches these shapes, Polar is the
best code to mirror. If your target differs (OAuth, per-tenant URL,
polling-only), combine Polar's structure with the relevant archetype
delta in `connector-archetypes.md`.
