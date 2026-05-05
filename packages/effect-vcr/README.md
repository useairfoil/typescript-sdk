# @useairfoil/effect-vcr

An `HttpClient` for Effect that records HTTP interactions to cassette files and replays them for future test runs.

The first time the following test is run, it sends the HTTP request to `httpbin.org` and stores the request/response pair to a cassette. All subsequent test runs replay the stored response and make no live HTTP requests.

```ts
// my-program.ts
import { Effect } from "effect";
import { HttpClient } from "effect/unstable/http";

export const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.get("https://httpbin.org/robots.txt");
  return yield* response.text;
});

// my-program.test.ts
import { NodeServices } from "@effect/platform-node";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(Layer.provide(NodeServices.layer));

const vcrRuntimeLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  NodeServices.layer,
  cassetteStoreLayer,
);

const vcrLayer = VcrHttpClient.layer({
  vcrName: "httpbin",
  mode: "auto",
}).pipe(Layer.provide(vcrRuntimeLayer));

describe("my awesome program", () => {
  it.effect("works", () => program.pipe(Effect.provide(vcrLayer)));
});
```

The main use case for the VCR is to let open source projects run tests against a real upstream API without exposing secrets to forks.

- project owners generate cassettes locally by talking to the real API
- external contributors run tests against committed cassettes
- CI runs deterministically from cassettes
- scheduled or manual runs can still hit the live API to catch upstream drift

## Package shape

Root exports:

- `CassetteStore`
- `FileSystemCassetteStore`
- `VcrHttpClient`
- `VcrConfig`
- `VcrMode`
- `VcrRequest`
- `VcrResponse`
- `VcrEntry`
- `Cassette`
- `CassetteFile`

Focused subpath exports are also available:

- `@useairfoil/effect-vcr/cassette-store`
- `@useairfoil/effect-vcr/file-system-cassette-store`
- `@useairfoil/effect-vcr/types`
- `@useairfoil/effect-vcr/vcr-http-client`

## Usage

Use the VCR by providing `VcrHttpClient.layer(...)` to the Effect being tested.

- `VcrHttpClient` wraps an existing `HttpClient` and adds record/replay behavior
- `FileSystemCassetteStore` persists cassette files to disk

`VcrHttpClient.layer(...)` depends on:

- a live `HttpClient` implementation such as `FetchHttpClient.layer`
- `Path.Path` for cassette name resolution
- `CassetteStore.CassetteStore` for persistence

`FileSystemCassetteStore.layer(...)` depends on:

- `FileSystem.FileSystem`
- `Path.Path`

In Node tests, `NodeServices.layer` satisfies those platform services.

## Configuration and defaults

### VcrHttpClient

```ts
type VcrConfig = {
  readonly vcrName?: string;
  readonly cassetteName?: string;
  readonly mode?: "record" | "replay" | "auto";
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

- `vcrName?: string`
  - logical VCR name used by `ACK_DISABLE_VCR`
- `cassetteName?: string`
  - cassette file basename or full file name
  - `users` resolves to `users.cassette`
  - `users.cassette` is preserved as-is
  - when omitted in Vitest, the cassette file defaults to `<test-file>.cassette` and the current test name becomes the export key inside that file
- `mode?: "record" | "replay" | "auto"`
  - `record`: always call the live client and write a cassette
  - `replay`: only serve from cassette; missing entries fail
  - `auto`: replay if the cassette exists, otherwise record; when `CI=true`, missing cassettes fail instead of recording
- `redact`
  - remove sensitive headers or JSON body keys before writing to disk
- `matchIgnore`
  - ignore request headers or JSON body keys when computing the request lookup key
- `match`
  - custom request matcher for advanced lookup behavior

Defaults:

- `mode` defaults to `"auto"`
- `authorization` is ignored for matching by default
- `authorization` is redacted from recorded request headers by default

### FileSystemCassetteStore

- `cassetteDir?: string`
  - changes the cassette root directory
  - when omitted in Vitest, cassettes are written to the `__cassettes__` directory beside the test file
  - outside Vitest, provide `cassetteDir` explicitly

## Matching and redaction

`matchIgnore` and `redact` solve different problems.

- `matchIgnore` changes how requests are matched to cassette entries
- `redact` changes what is persisted to disk

Typical usage:

```ts
const vcrLayer = VcrHttpClient.layer({
  vcrName: "shopify-products",
  mode: "auto",
  matchIgnore: {
    requestHeaders: ["x-shopify-access-token", "authorization"],
  },
  redact: {
    requestHeaders: ["x-shopify-access-token", "authorization"],
  },
});
```

Use `matchIgnore` when a request field should not affect cassette identity.

Use `redact` when a field should never be written to disk.

## Runtime configuration

The VCR is controlled by the following environment variables:

- `CI=true`
  - if the VCR mode is `auto`, tests with a missing cassette fail instead of recording
- `ACK_DISABLE_VCR=<...>`
  - disables the VCR and falls back to the wrapped live client
  - `*` disables all configured VCRs
  - a comma-separated list disables only matching `vcrName` values

When the VCR is disabled, cassette files are not updated.

## Common patterns

### Build the VCR runtime once

```ts
const cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(Layer.provide(NodeServices.layer));

const vcrRuntimeLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  NodeServices.layer,
  cassetteStoreLayer,
);

const vcrLayer = VcrHttpClient.layer({
  vcrName: "example",
  mode: "auto",
}).pipe(Layer.provide(vcrRuntimeLayer));
```

This keeps the dependency graph explicit:

- `FileSystemCassetteStore.layer(...)` gets its platform services from `NodeServices.layer`
- `VcrHttpClient.layer(...)` gets its live client, `Path.Path`, and cassette store from `vcrRuntimeLayer`

### Override config in tests

```ts
import { ConfigProvider, Layer } from "effect";

const vcrTestRuntimeLayer = Layer.mergeAll(
  vcrRuntimeLayer,
  ConfigProvider.layer(
    ConfigProvider.fromUnknown({
      CI: false,
      ACK_DISABLE_VCR: "",
    }),
  ),
);

const vcrLayer = VcrHttpClient.layer({
  vcrName: "example",
  mode: "auto",
}).pipe(Layer.provide(vcrTestRuntimeLayer));
```

### Use focused subpath imports

```ts
import * as VcrHttpClient from "@useairfoil/effect-vcr/vcr-http-client";
import * as FileSystemCassetteStore from "@useairfoil/effect-vcr/file-system-cassette-store";
```

Use root imports for normal package consumption and subpath imports when you want a narrower surface.
