# @useairfoil/effect-http-client

VCR-style HttpClient for Effect. Record and replay HTTP interactions via an Effect `Layer`, backed by a cassette store.

## Install

```bash
bun add @useairfoil/effect-http-client
```

## Usage

### Node.js

```ts
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import {
  CassetteStoreLive,
  VcrHttpClientLayer,
} from "@useairfoil/effect-http-client";

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
      cassetteDir: "./cassettes",
      cassetteName: "example",
      mode: "auto",
    }),
  ),
);
```

### Bun

```ts
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "@effect/platform";
import { BunFileSystem } from "@effect/platform-bun";
import {
  CassetteStoreLive,
  VcrHttpClientLayer,
} from "@useairfoil/effect-http-client";

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
      cassetteDir: "./cassettes",
      cassetteName: "example",
      mode: "auto",
    }),
  ),
);
```

## API

### `CassetteStore` service

Effect service used by the VCR client. Provide it with a Layer or override it.

```ts
export interface CassetteStoreService {
  readonly exists: (path: string) => Effect.Effect<boolean, CassetteStoreError>;
  readonly load: (path: string) => Effect.Effect<VcrCassette, CassetteStoreError>;
  readonly save: (path: string, cassette: VcrCassette) => Effect.Effect<void, CassetteStoreError>;
  readonly loadOrInit: (path: string) => Effect.Effect<VcrCassette, CassetteStoreError>;
}
```

### `CassetteStoreLive`

Default FileSystem-backed store. Requires `FileSystem` from `@effect/platform`.

### `VcrHttpClientLayer(config)`

Wraps the live `HttpClient` and applies VCR behavior.

```ts
type VcrMode = "record" | "replay" | "auto";

type VcrConfig = {
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

## Behavior

### Modes

- `record`: always call the live client and write a cassette.
- `replay`: only serve from cassette; missing entries fail with a transport error.
- `auto`: replay if cassette exists; otherwise record. If `CI=true`, missing cassette fails.

### Request keying

The request key is a stable JSON string of:

- method
- url
- headers (lowercased + sorted)
- body (stable stringify for JSON)

`matchIgnore` removes fields from the key. `redact` removes fields from the stored cassette.

### Response replay

Responses are reconstructed with `HttpClientResponse.fromWeb` using a new `Response` created from the stored body, status, and headers.

## Notes

- Request body streams are not consumed; they are represented as `"[stream]"` in the cassette.
- File system layer is provided by the user to keep this package platform-agnostic.
- CI detection uses Effect `Config` (`Config.boolean("CI")`), so it can be overridden with a `ConfigProvider`.
