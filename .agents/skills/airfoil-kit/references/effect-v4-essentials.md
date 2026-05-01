# effect-v4-essentials

The SDK is pinned to **Effect v4 beta** (`effect@4.0.0-beta.54`). Many
patterns changed from v2/v3. This file is the short list of idioms you
**must** use in connector code.

For deep dives, read:

- Effect v4 source/docs repo only: `https://github.com/effect-ts/effect-smol`
- Context7 Effect v4 LLM docs:
  `https://context7.com/effect-ts/effect-smol/llms.txt?tokens=10000`
- Context7 API guide (if using API directly):
  `https://context7.com/docs/api-guide`

Do **not** treat legacy Effect docs/repositories as Effect v4 source of truth
for this repo. They may reflect older API generations.

## Prerequisite check (Effect source mirror)

Before Effect-related implementation or refactors, verify a local mirror exists
at `.temp/effect-smol` (repo-local, disposable) and points to `effect-smol`.

If missing, clone it:

```bash
git clone https://github.com/Effect-TS/effect-smol.git .temp/effect-smol
```

If present, refresh it before deep API lookups:

```bash
git -C .temp/effect-smol pull --ff-only
```

Use this mirror as local, greppable ground truth when MCP tools are flaky.
It is disposable and can be deleted any time:

```bash
rm -rf .temp/effect-smol
```

Context7 quick use (recommended for Effect v4 content):

1. Resolve library id for Effect docs (`effect-smol`) and query docs.
2. Ask focused questions (service tags, Config patterns, HTTP paths).
3. Cross-check answers against local package APIs before coding.

DeepWiki MCP quick use (optional fallback):

1. Ensure the repo is indexed in DeepWiki (open
   `https://deepwiki.com/effect-ts/effect-smol` once if needed).
2. Read available topics: `deepwiki_read_wiki_structure({ repoName: "effect-ts/effect-smol" })`.
3. Ask focused questions: `deepwiki_ask_question({ repoName: "effect-ts/effect-smol", question: "..." })`.
4. Cross-check answers against local package APIs before coding.

If Context7/DeepWiki are unavailable, fall back to:

1. Local source in this repo (especially `packages/connector-kit/src/**` and
   `packages/effect-vcr/src/**`).
2. Official Effect docs + GitHub source.

Never block implementation on Context7/DeepWiki availability.

---

## API integration contract (checklist)

Apply this checklist for REST, GraphQL, and gRPC connectors:

1. **Config-only runtime/test inputs:** no `process.env` reads in connector
   code or tests; use `Config` and `ConfigProvider`.
2. **Service-layer clients:** build API clients as `Context.Service` +
   `Layer.effect(...)`, not ad-hoc singleton objects.
3. **Boundary decode:** parse external payloads with `Schema` at API boundaries
   before they enter stream/entity logic.
4. **Typed errors:** map unknown/transport/decode failures to tagged domain
   errors (`ConnectorError` and/or connector-specific tagged errors).
5. **Central transport policy:** retries, timeouts/deadlines, auth headers, and
   rate-limit behavior are configured in the API client layer, not scattered
   across connector orchestration code.

---

## 1. Imports you will use

```ts
import {
  Config,
  ConfigProvider,
  Context,
  DateTime,
  Deferred,
  Effect,
  Layer,
  Logger,
  Metric,
  Option,
  Queue,
  Ref,
  Stream,
} from "effect";

import * as Schema from "effect/Schema";
import * as Observability from "effect/unstable/observability";

import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  type HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
  type Headers,
} from "effect/unstable/http";

import { NodeHttpServer, NodeHttpClient, NodeFileSystem } from "@effect/platform-node";

import { describe, expect, it } from "@effect/vitest";
```

Notes:

- HTTP lives under `effect/unstable/http` in v4. Do not import from
  `@effect/platform` (that was the v2/v3 location).
- `Schema` lives at `effect/Schema`, not `@effect/schema`.
- `Context.Service` replaces `ServiceMap.Service` patterns from older versions.

## 2. Defining services

```ts
export class MyApiClient extends Context.Service<MyApiClient, MyApiClientService>()(
  "@useairfoil/producer-foo/MyApiClient",
) {}
```

- The string tag must be unique across all services.
- Use `yield* MyApiClient` inside `Effect.gen(function* () { ... })` to
  access the service.

## 3. Defining typed errors

```ts
import { Data } from "effect";

export class MyError extends Data.TaggedError("MyError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
```

`ConnectorError` is defined this way. Prefer tagged errors over plain
classes; they play well with `Effect.catchTag`.

## 4. Config and ConfigProvider

```ts
export const MyConfig = Config.all({
  apiToken: Config.string("FOO_API_TOKEN"),
  apiBaseUrl: Config.string("FOO_API_BASE_URL").pipe(Config.withDefault("https://api.foo.com")),
  webhookSecret: Config.option(Config.string("FOO_WEBHOOK_SECRET")),
});
```

- `Config.option(...)` returns `Option.Option<string>` — check with
  `Option.isSome` / `Option.isNone`.
- `Config.withDefault(v)` makes a field optional with a fallback.
- `Config.port(name)` parses integers.
- `Config.boolean(name)` parses `"true"` / `"false"`.

Runtime wiring:

```ts
Layer.succeed(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromEnv(), // or fromUnknown({ FOO_API_TOKEN: "..." })
);
```

Never read `process.env` directly in library code; always go through
`Config`.

## 5. Layers

- `Layer.succeed(Tag)(impl)` — constant service.
- `Layer.effect(Tag)(effect)` — service built from an Effect.
- `Layer.mergeAll(a, b, c)` — union two or more layers.
- `Layer.provide(layer)` — provide a sub-layer that the outer layer depends on.
- `Layer.unwrap(Effect.gen(function* () { return Layer.mergeAll(...) }))` —
  dynamically decide which layers to build based on config.
- `Layer.empty` — the no-op layer, useful in `Layer.unwrap` branches.

## 6. Effect.gen is the default style

```ts
Effect.gen(function* () {
  const config = yield* MyConfig;
  const api = yield* MyApiClient;
  const rows = yield* api.fetchList(schema, path, options);
  return rows;
});
```

- Use `yield*` for every Effect, never `await`.
- Mapping simple values: `Effect.map`, `Effect.andThen`.
- Mapping errors: `Effect.mapError` or `Effect.catchTag`.

## 7. HttpClient pipeline

```ts
const client = (yield * HttpClient.HttpClient).pipe(
  HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
  HttpClient.mapRequest(HttpClientRequest.bearerToken(token)),
  HttpClient.mapRequest(HttpClientRequest.acceptJson),
);

const request = HttpClientRequest.get("/v1/things").pipe(
  HttpClientRequest.setUrlParams({ page: "1" }),
);

const rows =
  yield *
  Effect.scoped(
    client.execute(request).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((response) => response.json),
      Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    ),
  );
```

- Always `Effect.scoped(...)` around `client.execute(...)` unless the
  surrounding context is already scoped.
- `HttpClient.transform((effect, request) => ...)` lets you wrap requests
  (that's how VCR is built).

## 8. Streams

- `Stream.fromEffect(e)` — single-element stream.
- `Stream.fromQueue(q)` — stream that emits whatever is pushed to the queue.
- `Stream.unfold(state, step)` — the building block behind `makePullStream`.
- `Stream.merge(a, b)` — run two streams concurrently.
- `Stream.map(s, f)`, `Stream.mapEffect(s, f)` — transform batches.
- `Stream.tap(s, f)` — side effect on each element.
- `Stream.runForEach(s, f)` — drain.

## 9. Concurrency primitives

- `Ref.make(value)`, `Ref.get(ref)`, `Ref.update(ref, fn)`,
  `Ref.updateAndGet(ref, fn)`.
- `Deferred.make<A, E>()`, `Deferred.succeed(d, v)`, `Deferred.await(d)`.
- `Queue.bounded<A>(capacity)`, `Queue.offer(q, v)`, `Queue.take(q)`.
- `Effect.forkScoped(effect)` — spawn in the current scope; the fiber is
  interrupted when the scope closes.
- `Effect.all([a, b], { concurrency: "unbounded" })` — run in parallel.

## 10. Schema

```ts
const Post = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  body: Schema.NullOr(Schema.String),
  tags: Schema.Array(Schema.String),
  status: Schema.Literals(["draft", "published"]),
  metadata: Schema.Record(Schema.String, Schema.Any),
  nested: Schema.optional(Schema.Struct({ foo: Schema.String })),
});

type Post = Schema.Schema.Type<typeof Post>;
```

- `Schema.decodeUnknownEffect(schema)(value)` returns
  `Effect.Effect<A, ParseError>`.
- Use `Schema.Any` for fields you don't want to validate (common for Polar's
  `product` / `discount` fields which are large nested objects).

## 11. Observability

- `Effect.withSpan("span.name", { attributes: {...} })` — wrap an effect
  in a tracing span.
- `Metric.counter("name", { description })`, `Metric.histogram("name", { boundaries })`,
  `Metric.update(metric, value)`, `Metric.withAttributes(metric, attrs)`.
- Provide telemetry via `Observability.Otlp.layerJson({ baseUrl, resource })`
  from `effect/unstable/observability`.

Avoid high-cardinality labels (user ids, request ids, timestamps).

## 12. Vitest + Effect

```ts
import { describe, expect, it } from "@effect/vitest";

describe("things", () => {
  it.effect("works", () =>
    Effect.gen(function* () {
      const result = yield* something;
      expect(result).toBe(42);
    }).pipe(Effect.provide(TestLayer)),
  );
});
```

- `it.effect` expects an Effect. The framework runs it with a default
  runtime and fails the test on any unhandled defect.
- To run your own scoped effect, wrap with `Effect.scoped`.

---

## What **not** to do

- `import { ... } from "@effect/platform"` — v2/v3 only.
- `import * as Schema from "@effect/schema"` — v2/v3 only.
- `ServiceMap.Service` examples — use `Context.Service` instead.
- `process.env.FOO` in library code — always `Config.string("FOO")`.
- `Effect.die(new Error(...))` for expected failures — use tagged errors.
- `async/await` inside `Effect.gen` — use `yield*`.
- Mutating a `Ref` without `Ref.update` — the whole point is atomic updates.
- `Stream.bracket`, `Stream.ensuring` from v2 — v4 uses `Effect.scoped`
  and `Scope` instead.

When a pattern you find online doesn't match what's in the repo, trust
the repo: `connectors/producer-polar/` and `packages/connector-kit/`
are the ground truth.
