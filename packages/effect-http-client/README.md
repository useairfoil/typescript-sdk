# @useairfoil/effect-http-client

VCR-style HttpClient for Effect. Record and replay HTTP interactions via an Effect Layer backed by a cassette store.

---

## User guide (record and replay HTTP)

### Install

```bash
bun add @useairfoil/effect-http-client
```

### Node.js example

```ts
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { CassetteStoreLive, VcrHttpClientLayer } from "@useairfoil/effect-http-client";

const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.get("https://example.com");
  return yield* response.text;
});

const runnable = program.pipe(
  Effect.provide(NodeFileSystem.layer),
  Effect.provide(CassetteStoreLive),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(
    VcrHttpClientLayer({
      connectorName: "producer-polar",
      cassetteDir: "./cassettes",
      cassetteName: "example",
      mode: "auto",
    }),
  ),
);

Effect.runPromise(runnable);
```

### Bun example

```ts
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "@effect/platform";
import { BunFileSystem } from "@effect/platform-bun";
import { CassetteStoreLive, VcrHttpClientLayer } from "@useairfoil/effect-http-client";

const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.get("https://example.com");
  return yield* response.text;
});

const runnable = program.pipe(
  Effect.provide(BunFileSystem.layer),
  Effect.provide(CassetteStoreLive),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(
    VcrHttpClientLayer({
      connectorName: "producer-polar",
      cassetteDir: "./cassettes",
      cassetteName: "example",
      mode: "auto",
    }),
  ),
);

Effect.runPromise(runnable);
```

---

## Development (API and behavior)

### CassetteStore service

Effect service used by the VCR client. Provide it with a Layer or override it.

```ts
export interface CassetteStoreService {
  readonly exists: (path: string) => Effect.Effect<boolean, CassetteStoreError>;
  readonly load: (path: string) => Effect.Effect<VcrCassette, CassetteStoreError>;
  readonly save: (path: string, cassette: VcrCassette) => Effect.Effect<void, CassetteStoreError>;
  readonly loadOrInit: (path: string) => Effect.Effect<VcrCassette, CassetteStoreError>;
}
```

`CassetteStoreLive` is the default FileSystem-backed store. It requires a `FileSystem` layer from `@effect/platform`.

### VcrHttpClientLayer

`VcrHttpClientLayer(config)` wraps the live `HttpClient` and applies VCR behavior.

```ts
type VcrMode = "record" | "replay" | "auto";

type VcrConfig = {
  connectorName: string;
  cassetteDir: string;
  cassetteName: string;
  mode: VcrMode;
  redact?: {
    requestHeaders?: ReadonlyArray<string>;
    responseHeaders?: ReadonlyArray<string>;
    requestBodyKeys?: ReadonlyArray<string>;
    responseBodyKeys?: ReadonlyArray<string>;
  };
  matchIgnore?: {
    requestHeaders?: ReadonlyArray<string>;
    requestBodyKeys?: ReadonlyArray<string>;
  };
  match?: (request: VcrRequest, entry: VcrEntry) => boolean;
};
```

### Behavior

Modes:

- `record`: always call the live client and write a cassette.
- `replay`: only serve from cassette; missing entries fail.
- `auto`: replay if cassette exists, otherwise record. If `CI=true`, missing cassette fails.

Request keying:

- method
- url
- headers (lowercased and sorted)
- body (stable stringify for JSON)

`matchIgnore` removes fields from the key. `redact` removes fields from stored cassettes.

Notes:

- Request body streams are not consumed; they are represented as `"[stream]"`.
- CI detection uses Effect Config (`Config.boolean("CI")`), so you can override it with a `ConfigProvider`.
- Connector-selective bypass is supported via `ACK_DISABLE_VCR` (comma-separated connector slugs).
- Set `connectorName` in `VcrConfig` to enable connector-specific bypass matching against `ACK_DISABLE_VCR`.
