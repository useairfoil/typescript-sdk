# effect-vcr-api

Reference notes for `@useairfoil/effect-vcr`.

## Package exports

From `packages/effect-vcr/src/index.ts`:

- `CassetteStore` namespace (`cassette-store.ts`)
- `FileSystemCassetteStore` namespace (`file-system-cassette-store.ts`)
- `VcrHttpClient` namespace (`vcr-http-client.ts`)

## Core types and services

- `CassetteStore.CassetteStore` service tag
- `CassetteStore.CassetteStoreError`
- `CassetteStore.createEmptyCassette()`
- `CassetteStore.createEmptyCassetteFile()`

`FileSystemCassetteStore.layer()` provides a filesystem-backed cassette store.

## VCR HTTP layer

Use `VcrHttpClient.layer({ ... })` to wrap `HttpClient.HttpClient` with
record/replay behavior.

Common config fields:

- `vcrName?: string`
- `cassetteName?: string`
- `mode?: "record" | "replay" | "auto"`
- `redact?: { requestHeaders?, responseHeaders?, requestBodyKeys?, responseBodyKeys? }`
- `matchIgnore?: { requestHeaders?, requestBodyKeys? }`
- `match?: (request, entry) => boolean`

## Typical test wiring

```ts
import { NodeServices } from "@effect/platform-node";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-<service>",
  mode: "replay",
}).pipe(
  Layer.provideMerge(FileSystemCassetteStore.layer()),
  Layer.provideMerge(FetchHttpClient.layer),
  Layer.provideMerge(NodeServices.layer),
);

const program = Effect.gen(function* () {
  // call connector runtime / stream logic that needs HttpClient
});

const runnable = program.pipe(Effect.provide(vcrLayer));
```

## Cassette naming

Under Vitest, inferred cassette names follow `<test-file-basename>.cassette`.

Example:

- test file: `test/api.vcr.test.ts`
- cassette file: `test/__cassettes__/api.vcr.test.cassette`

## Environment behavior

- `ACK_DISABLE_VCR` can bypass VCR by `vcrName` (comma-separated list or `*`).
- In `auto` mode, missing cassette behavior is CI-sensitive (fails in CI,
  records locally).

## Source of truth

- `packages/effect-vcr/src/types.ts`
- `packages/effect-vcr/src/cassette-store.ts`
- `packages/effect-vcr/src/file-system-cassette-store.ts`
- `packages/effect-vcr/src/vcr-http-client.ts`
