# webhooks

How to wire inbound webhooks, and what to do when the target platform has
no webhooks at all.

## Anatomy of a `WebhookRoute`

```ts
import { Ingestion, Webhook } from "@useairfoil/connector-kit";
import { Effect } from "effect";
import * as Schema from "effect/Schema";

const ExamplePayloadSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal("post.created"), data: PostSchema }),
  Schema.Struct({ type: Schema.Literal("post.updated"), data: PostSchema }),
]);

const route = Webhook.route({
  path: "/webhooks/example",
  schema: ExamplePayloadSchema,
  handle: (payload, request, rawBody) =>
    Effect.gen(function* () {
      // 1. Verify signature (if applicable)
      // 2. Dispatch by payload.type to the correct entity/event stream
    }),
});
```

- `path` — relative URL mounted by `runConnector`. Prepend `/webhooks/` by
  convention to keep the tree tidy.
- `schema` — Effect Schema used by the kit to decode **after** the route
  body has been read. Signature verification should use the raw body.
- `handle(payload, request, rawBody)` — your handler.
  - `payload`: decoded value of `schema`.
  - `request`: `HttpServerRequest.HttpServerRequest` — use for headers.
  - `rawBody`: `Uint8Array | undefined` — only populated when the transport
    preserves it (the kit does).

The handler returns `Effect<void, ConnectorError>`. A success maps
to 200 OK; a failure maps to 500 unless you catch and return `Effect.void`
for idempotency cases (duplicate deliveries).

## Registering routes with `runConnector`

```ts
import { NodeHttpServer } from "@effect/platform-node";

yield *
  Ingestion.runConnector(connector, {
    webhook: {
      routes: [route],
      healthPath: "/health", // default; override if the platform requires it
    },
  }).pipe(Effect.provide(NodeHttpServer.layer({ port: config.webhookPort })));
```

- Provide a platform server layer separately (`NodeHttpServer.layer`,
  `NodeHttpServer.layerTest`, or Bun equivalents) via `Effect.provide`.
- Keep other runtime dependencies in layers outside the `runConnector(...)`
  call. The server layer is the usual webhook-specific dependency provided at
  the effect site.
- `healthPath` — auto-mounted returning `"ok"` with 200.
- `disableHttpLogger` — set `true` in noisy CI if you want to silence
  the default access-log middleware.

Omit the `webhook` option entirely if the connector is polling-only.

## Signature verification

Implement signature verification strictly from official platform docs. Do not
reuse another provider's signing recipe.

Use the raw body when the platform signs exact request bytes. Never substitute
`JSON.stringify(payload)` unless the provider contract explicitly says so.

```ts
handle: (payload, request, rawBody) =>
  Effect.gen(function* () {
    if (Option.isNone(config.webhookSecret)) {
      yield* Effect.logWarning("Webhook secret unset; skipping verification");
    } else if (rawBody) {
      yield* verifySignature({
        rawBody,
        secret: config.webhookSecret.value,
        signatureHeader: Headers.get(request.headers, "x-sig"),
      });
    } else {
      yield* Effect.fail(
        new ConnectorError({
          message: "Missing raw body; cannot verify signature",
        }),
      );
    }
    // ... dispatch
  });
```

See `example-webhook-verification.md` for optional illustrative patterns.
Platform docs always override examples.

### Key rules

- Run signature verification **before dispatching/publishing side effects**.
  (`WebhookRoute.handle` receives already-decoded payload plus `rawBody`.)
- Use the comparison and verification primitives required by the provider.
  For HMAC flows, use a constant-time comparison.
- When the secret is `Option.none()` (explicitly missing), **log a
  warning** but do not crash — this keeps local development workable.
- Wrap verification errors into `ConnectorError` so `runConnector`'s
  error channel stays narrow.

## Dispatch by event type

Always switch exhaustively:

```ts
switch (payload.type) {
  case "post.created":
  case "post.updated":
    return (
      yield *
      dispatchEntityWebhook({
        queue: streams.posts.live,
        cutoff: streams.posts.cutoff,
        cursor: payload.data.id.toString(),
        row: payload.data,
      })
    );
  case "unrelated.event":
    return Effect.void; // ignore intentionally
  default:
    return Effect.logWarning("Unknown webhook type").pipe(
      Effect.annotateLogs({ type: (payload as { type: string }).type }),
    );
}
```

Exhaustive switches force you to look at new event types when they
appear, rather than silently dropping them.

## Polling fallback (when no webhooks exist)

For platforms without webhooks, replace the `live` stream with a polled
stream that repeats fetching on a schedule. You still use `makePullStream`
for backfill, but the "live" side comes from `Stream.repeatEffect` or
`Stream.schedule`.

```ts
import { Stream, Schedule, Effect } from "effect";

const live: Stream.Stream<Batch<Post>, ConnectorError, TemplateApiClient> = Stream.unwrap(
  Effect.gen(function* () {
    const api = yield* TemplateApiClient;
    return Stream.repeatEffect(
      Effect.gen(function* () {
        const page = yield* api.fetchList(PostSchema, "/posts", { page: 1 });
        return {
          cursor: page.items[0].id.toString(),
          rows: page.items,
        } satisfies Batch<Post>;
      }),
    ).pipe(Stream.schedule(Schedule.spaced("30 seconds")));
  }),
);
```

Notes for polling-only connectors:

- Do **not** pass the `webhook` option to `runConnector`. The kit will
  skip all HTTP server setup.
- The cutoff deferred is still required by the engine. Set it via
  `initialCutoff` in `RunConnectorOptions`, or resolve it synthetically on
  first poll.
- Per-poll cursor must advance — if not, you will re-publish the same
  rows on every tick (the seen-set will dedupe, but you're wasting work).

## Multiple routes

Connectors with multiple event sources (e.g., Stripe sends to `/webhooks`
but GitHub mounts `/hooks/<service>`) list multiple routes:

```ts
routes: [postsWebhookRoute, commentsWebhookRoute],
```

Each route gets its own `schema` and `handle`. Typically they share a
single secret; have each handler read from the same `config.webhookSecret`.

## Testing webhooks

```ts
import { NodeHttpServer, NodeHttpClient } from "@effect/platform-node";
import { HttpClientRequest, HttpClient } from "effect/unstable/http";

const ServerLayer = NodeHttpServer.layerTest;

it.effect("dispatches webhook", () =>
  Effect.gen(function* () {
    yield* Effect.forkScoped(
      Ingestion.runConnector(connector, {
        webhook: {
          /* ... */
        },
      }),
    );

    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.post("/webhooks/example").pipe(
        HttpClientRequest.bodyJsonUnsafe({ type: "post.created", data: post }),
      ),
    );
    expect(response.status).toBe(200);

    const batches = yield* capturedBatches;
    expect(batches).toHaveLength(1);
  }).pipe(Effect.provide(layers)),
);
```

`NodeHttpServer.layerTest` wires server + client to an in-process
transport — no real port needed.

Current test composition shape:

- `connectorLayer = layerConfig.pipe(Layer.provide(apiLayer))`
- `runLayer = Layer.mergeAll(Ingestion.layerMemory, testPublisherLayer, runtimeLayer)`
- fork `Ingestion.runConnector(...)`
- provide `connectorLayer` with `runtimeLayer` and `ConfigProvider` already
  satisfied

## Gotchas

- **Deliveries arrive before backfill is ready.** The kit's cutoff
  Deferred handles this: first live event sets the cutoff, backfill waits.
  Don't try to block deliveries on a "ready" flag — you'll lose them.
- **Idempotency**. Most platforms retry on non-2xx. Returning 200 is
  sufficient; the kit's seen-set handles duplicate rows.
- **Large payloads**. Platforms cap webhook body size; for bulk imports,
  receive a notification and then fetch the full object via the API.
- **Ordering**. Webhook delivery order is never guaranteed. Use the
  cursor field (monotonic, usually `updated_at`) to deduplicate.
