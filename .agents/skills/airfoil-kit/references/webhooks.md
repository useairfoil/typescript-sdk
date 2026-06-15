# webhooks

How to wire inbound webhooks, and what to do when the target platform has no webhooks at all.

## Anatomy Of A Route

```ts
import { Resource, Webhook } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";
import { HttpServerResponse } from "effect/unstable/http";

const ExamplePayloadSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal("post.created"), data: PostSchema }),
  Schema.Struct({ type: Schema.Literal("post.updated"), data: PostSchema }),
);

const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
  webhook: Resource.webhook({
    schema: ExamplePayloadSchema,
    handler: ({ payload }) => Effect.succeed([Resource.upsert(payload.data)]),
  }),
});

const route = Webhook.route({
  path: "/webhooks/example",
  ackMode: "after-publish",
  schema: ExamplePayloadSchema,
  handler: ({ request, rawBody, payload, to }) =>
    Effect.gen(function* () {
      yield* verifySignature({ request, rawBody });

      switch (payload.type) {
        case "post.created":
        case "post.updated":
          yield* to(Posts, payload);
          break;
      }

      return HttpServerResponse.jsonUnsafe({ ok: true });
    }),
});
```

Route fields:

- `path`: relative URL mounted by `ConnectorApp.start(...)`.
- `ackMode`: `"after-publish"` or `"after-enqueue"`.
- `schema`: route-level Effect schema decoded after raw body read and JSON parse.
- `handler`: receives `request`, `rawBody`, typed `payload`, and `to(...)`.

The handler returns an `HttpServerResponse`. Invalid JSON or invalid route payloads return `400`. Unexpected handler/runtime/publisher failures return `500`.

## Signature Verification

Implement signature verification strictly from official platform docs. Do not reuse another provider's signing recipe.

Use the raw body when the platform signs exact request bytes. Never substitute `JSON.stringify(payload)` unless the provider contract explicitly says so.

```ts
handler: ({ request, rawBody, payload, to }) =>
  Effect.gen(function* () {
    if (Option.isNone(config.webhookSecret)) {
      yield* Effect.logWarning("Webhook secret unset; skipping verification");
    } else {
      yield* verifySignature({
        rawBody,
        secret: config.webhookSecret.value,
        signatureHeader: request.headers["x-sig"] ?? null,
      });
    }

    yield* to(Posts, payload);
    return HttpServerResponse.jsonUnsafe({ ok: true });
  });
```

Key rules:

- Run signature verification before `to(...)`.
- Use the comparison and verification primitives required by the provider.
- For HMAC flows, use a constant-time comparison.
- When the secret is explicitly missing for local development, log a warning.
- For production connectors, missing required signature inputs should return a non-2xx response.

## Dispatch By Event Type

Always switch explicitly:

```ts
switch (payload.type) {
  case "post.created":
  case "post.updated":
    yield * to(Posts, payload);
    break;
  case "unrelated.event":
    break;
  default:
    yield *
      Effect.logWarning("Unknown webhook type").pipe(Effect.annotateLogs({ type: payload.type }));
}
```

Exhaustive switches force you to look at new event types when they appear, rather than silently dropping them.

## Polling Fallback

For platforms without webhooks, omit `webhooks` from the connector and use `Fetch.changes(...)` for polling.

```ts
const Posts = Resource.entity({
  name: "posts",
  schema: PostSchema,
  key: "id",
  version: "updatedAt",
  backfill,
  changes: Fetch.changes({
    cursor: Cursor.isoDateTime(),
    interval: "30 seconds",
    fetch: ({ cursor }) =>
      api.fetchPostChanges({ since: cursor }).pipe(
        Effect.map((page) => ({
          mutations: page.items.map(Resource.upsert),
          cursor: page.nextCursor,
        })),
      ),
  }),
});
```

Notes for polling-only connectors:

- Do not define connector webhook routes.
- Ensure the changes cursor always advances.
- Use provider rate-limit guidance to choose the polling interval.

## Multiple Routes

Connectors with multiple event sources list multiple routes in `Connector.define(...)`:

```ts
return Connector.define({
  name: "producer-example",
  resources: [Posts],
  webhooks: [providerRoute, adminRoute],
});
```

Prefer one route per provider endpoint unless the provider requires path-level separation.
