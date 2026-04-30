# effect-vcr-api

Reference notes for `@useairfoil/effect-vcr`.

## Package exports

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

Focused subpath exports:

- `@useairfoil/effect-vcr/cassette-store`
- `@useairfoil/effect-vcr/file-system-cassette-store`
- `@useairfoil/effect-vcr/types`
- `@useairfoil/effect-vcr/vcr-http-client`

## Core services and helpers

- `CassetteStore.CassetteStore`
- `CassetteStore.CassetteStoreError`
- `CassetteStore.createEmptyCassette()`
- `CassetteStore.createEmptyCassetteFile()`
- `FileSystemCassetteStore.layer({ cassetteDir? })`
- `VcrHttpClient.layer(config)`

`FileSystemCassetteStore.layer(...)` provides a filesystem-backed cassette store.

## `VcrConfig`

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

Important behavior:

- `cassetteName: "users"` resolves to `users.cassette`
- `cassetteName: "users.cassette"` is preserved as-is
- when `cassetteName` is omitted in Vitest, the cassette file defaults to the
  test file name and the current test name becomes the export key inside that
  cassette file

Defaults:

- `mode` defaults to `"auto"`
- `authorization` is ignored for matching by default
- `authorization` is redacted from recorded request headers by default

## Typical VCR runtime wiring

```ts
import { NodeServices } from "@effect/platform-node";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const cassetteStoreLayer = FileSystemCassetteStore.layer().pipe(Layer.provide(NodeServices.layer));

const vcrRuntimeLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  NodeServices.layer,
  cassetteStoreLayer,
);

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-<service>",
  mode: "replay",
}).pipe(Layer.provide(vcrRuntimeLayer));
```

Why this shape matters:

- `FileSystemCassetteStore.layer()` needs filesystem and `Path`
- `VcrHttpClient.layer(...)` needs a live `HttpClient`, `Path`, and a
  `CassetteStore`
- sibling-merging these layers does not satisfy dependencies transitively

## Cassette naming

Under Vitest, inferred cassette names follow `<test-file-basename>.cassette`.

Example:

- test file: `test/api.vcr.test.ts`
- cassette file: `test/__cassettes__/api.vcr.test.cassette`

## Environment behavior

- `ACK_DISABLE_VCR` bypasses VCR by `vcrName` (`*` or comma-separated list)
- in `auto` mode, missing cassette behavior is CI-sensitive
- when VCR is disabled, the wrapped live client is returned directly and no
  cassette read/write occurs

## Source of truth

- `packages/effect-vcr/src/types.ts`
- `packages/effect-vcr/src/cassette-store.ts`
- `packages/effect-vcr/src/file-system-cassette-store.ts`
- `packages/effect-vcr/src/vcr-http-client.ts`
