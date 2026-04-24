# effect-http-client-api

Exhaustive reference for every export of
[`@useairfoil/effect-http-client`](../../../packages/effect-http-client/).

Import from the package root:

```ts
import {
  CassetteStore,
  CassetteStoreError,
  CassetteStoreLive,
  createEmptyCassette,
  VcrHttpClientLayer,
} from "@useairfoil/effect-http-client";

import type {
  CassetteStoreService,
  VcrCassette,
  VcrCassetteFile,
  VcrConfig,
  VcrEntry,
  VcrMode,
  VcrRequest,
  VcrResponse,
} from "@useairfoil/effect-http-client";
```

---

## Concepts

VCR is a record-and-replay layer around
`effect/unstable/http`'s `HttpClient`. It lets tests exercise the real
network once, persist the request/response pair as JSON, and replay it
deterministically in CI.

A **cassette file** is a JSON document containing one or more **exports**.
Each export groups entries under an arbitrary key (Vitest uses the test
name). Each **entry** pairs a canonicalized request with a response.

---

## Types

### `VcrMode`

```ts
type VcrMode = "record" | "replay" | "auto";
```

- `record`: always hit the network; overwrite/append cassette entries.
- `replay`: never hit the network; fail if the entry is missing.
- `auto`: replay when a cassette file exists; record otherwise. In CI
  (`CI=true`), missing cassettes fail instead of recording.

### `VcrRequest` / `VcrResponse` / `VcrEntry`

```ts
type VcrRequest = {
  readonly method: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
};

type VcrResponse = {
  readonly status: number;
  readonly body: string;
  readonly headers?: Record<string, string>;
};

type VcrEntry = { readonly request: VcrRequest; readonly response: VcrResponse };
```

Bodies are strings. Non-string bodies (streams, form data) are stored as
placeholders (`[stream]`, `[form-data]`) and will fail replay — do not
exercise those code paths in VCR tests.

### `VcrCassette` / `VcrCassetteFile`

```ts
type VcrCassette = {
  readonly meta: { readonly createdAt: string; readonly version: string };
  readonly entries: Record<string, VcrEntry>;
};

type VcrCassetteFile = {
  readonly exports: Record<string, VcrCassette>;
};
```

Entries are keyed by a stable hash of the normalized request (method, URL,
sorted+lowercased headers, JSON-stable body). `authorization` is stripped
by default before keying — two runs with different tokens still match.

### `VcrConfig`

```ts
type VcrConfig = {
  readonly connectorName: string;                // required — used by ACK_DISABLE_VCR
  readonly cassetteDir?: string;                 // defaults to test file's __cassettes__/
  readonly cassetteName?: string;                // defaults to <test-file>.cassette
  readonly mode?: VcrMode;                       // default "auto"
  readonly redact?: {
    readonly requestHeaders?: ReadonlyArray<string>;
    readonly responseHeaders?: ReadonlyArray<string>;
    readonly requestBodyKeys?: ReadonlyArray<string>;
    readonly responseBodyKeys?: ReadonlyArray<string>;
  };
  readonly matchIgnore?: {
    readonly requestHeaders?: ReadonlyArray<string>;
    readonly requestBodyKeys?: ReadonlyArray<string>;
  };
  readonly match?: (request: VcrRequest, entry: VcrEntry) => boolean;
};
```

- `connectorName` is required. It participates in the `ACK_DISABLE_VCR`
  bypass: set `ACK_DISABLE_VCR=producer-stripe,producer-polar` to skip the
  VCR shim for those connectors and hit the network directly.
- `redact` removes sensitive fields before writing to disk. `authorization`
  is always redacted unless explicitly overridden.
- `matchIgnore` drops fields from the request key so e.g. a rotating token
  header doesn't break replay. `authorization` is ignored by default.
- `match` is a custom matcher that overrides key-based lookup.

### `CassetteStoreService`

```ts
interface CassetteStoreService {
  readonly exists: (path: string) => Effect.Effect<boolean, CassetteStoreError>;
  readonly load: (path: string) => Effect.Effect<VcrCassetteFile, CassetteStoreError>;
  readonly save: (path: string, cassette: VcrCassetteFile) => Effect.Effect<void, CassetteStoreError>;
  readonly loadOrInit: (path: string) => Effect.Effect<VcrCassetteFile, CassetteStoreError>;
}
```

Backend abstraction. The only built-in implementation is
`CassetteStoreLive` (Node/Bun file system). Tests can provide a custom
in-memory store for hermetic unit tests.

### `CassetteStoreError`

`TaggedErrorClass<"CassetteStoreError">` with `operation` ∈
`{ "exists" | "load" | "save" | "loadOrInit" }`, `path`, optional `message`,
optional `cause`.

---

## Layers

### `CassetteStoreLive`

```ts
CassetteStoreLive: Layer.Layer<CassetteStore, never, FileSystem.FileSystem>;
```

Provides `CassetteStore` backed by the Effect `FileSystem` service. You
must provide a platform layer below it:

```ts
import { NodeFileSystem } from "@effect/platform-node";

const cassetteLayer = CassetteStoreLive.pipe(
  Layer.provide(NodeFileSystem.layer),
);
```

On Bun, use `BunFileSystem.layer` instead.

### `VcrHttpClientLayer(config)` (exported as `layer`, re-exported under the alias)

```ts
VcrHttpClientLayer(config: VcrConfig): Layer.Layer<
  HttpClient.HttpClient,
  never,
  HttpClient.HttpClient | CassetteStore
>;
```

Wraps an existing `HttpClient` with VCR behavior. You must provide both a
real `HttpClient.HttpClient` (e.g. `NodeHttpClient.layerFetch`) and a
`CassetteStore` layer below it:

```ts
const vcrLayer = VcrHttpClientLayer({
  connectorName: "producer-stripe",
  mode: "auto",
  redact: { requestHeaders: ["stripe-account"] },
}).pipe(
  Layer.provide(
    Layer.mergeAll(NodeHttpClient.layerFetch, cassetteLayer),
  ),
);
```

---

## Utilities

### `createEmptyCassette()`

```ts
createEmptyCassette(): Effect.Effect<VcrCassette>;
```

Returns a new cassette with the current timestamp and schema version `"1"`.
Mostly used internally; tests rarely need this directly.

---

## Cassette file on disk

Default path resolution (when `cassetteDir`/`cassetteName` are not set):

- `<test-file>.vcr.test.ts` located at `test/api.vcr.test.ts`.
- Cassette path is `test/__cassettes__/api.vcr.test.ts.cassette`.
- Export key defaults to the currently running test name ("describe > test").

Explicit override:

```ts
VcrHttpClientLayer({
  connectorName: "producer-stripe",
  cassetteDir: "cassettes",
  cassetteName: "customers-backfill.json",
  mode: "auto",
});
```

---

## Environment variables

- `CI`: when truthy, `auto` mode fails instead of recording a missing cassette.
- `ACK_DISABLE_VCR`: comma-separated list of connector names to bypass VCR
  (e.g. `ACK_DISABLE_VCR=producer-stripe,producer-polar`). Matched
  case-insensitively against `VcrConfig.connectorName`. Resolved via Effect
  `Config`, not direct `process.env` access.

---

## Common patterns

### Basic replay test

```ts
const cassetteLayer = CassetteStoreLive.pipe(Layer.provide(NodeFileSystem.layer));
const vcrLayer = VcrHttpClientLayer({
  connectorName: "producer-stripe",
  mode: "replay",
}).pipe(Layer.provide(Layer.mergeAll(NodeHttpClient.layerFetch, cassetteLayer)));

const program = Effect.gen(function* () {
  const api = yield* MyApiClient;
  return yield* api.fetchList(Schema.Any, "/v1/customers", { limit: 10 });
}).pipe(
  Effect.provide(MyApiLayer),
  Effect.provide(vcrLayer),
  Effect.provideService(ConfigProvider.ConfigProvider, testConfig),
);
```

### Recording new data

1. Add real credentials to `.env`.
2. Change `mode: "replay"` to `mode: "record"` in the test file.
3. Delete the old cassette if the endpoint shape changed.
4. Run `bun run --cwd connectors/producer-<service> test`.
5. Inspect the cassette — verify no secrets slipped through `redact`.
6. Revert to `mode: "replay"`.
7. Commit the cassette.

### Redacting sensitive response fields

```ts
VcrHttpClientLayer({
  connectorName: "producer-acme",
  mode: "auto",
  redact: {
    requestHeaders: ["authorization", "x-acme-token"],
    responseHeaders: ["set-cookie"],
    responseBodyKeys: ["api_key", "secret"],
  },
});
```

`requestBodyKeys` / `responseBodyKeys` work against top-level object keys
(JSON bodies only); they recurse into arrays and nested objects. Non-JSON
bodies are passed through unchanged.

### Forcing live traffic without removing VCR

```bash
ACK_DISABLE_VCR=producer-stripe bun run --cwd connectors/producer-stripe test
```

Useful for debugging a single connector against a live sandbox without
reworking any test layers.

---

## Troubleshooting

- **"VCR replay missing entry for METHOD URL"** — the recorded cassette
  doesn't contain a matching entry. Either the request key drifted (new
  header, different body) or you haven't recorded yet. In `record` mode,
  retry; in `replay` mode, regenerate the cassette.
- **"VCR cassette path could not be inferred"** — you're using VCR outside
  Vitest. Pass `cassetteDir` and `cassetteName` explicitly.
- **"Invalid cassette file format"** — a cassette was manually edited and
  broke the `{ exports: {...} }` wrapper. Re-record from scratch.
- **Headers differ between environments and break matching** — add the
  offending header to `matchIgnore.requestHeaders`. Common culprits:
  `user-agent`, `x-request-id`, `traceparent`, `content-length`.
