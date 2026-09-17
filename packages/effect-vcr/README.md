# Effect VCR

This package records Effect HTTP requests into cassette files. Tests can replay
the same requests later.

## Install

```bash
pnpm add -D @useairfoil/effect-vcr @effect/platform-node@rc effect@rc
```

## Usage

Use `VcrHttpClient.layer(...)` around the live Effect HTTP client and
`FileSystemCassetteStore.layer(...)` for cassette files.

```ts
import { NodeServices } from "@effect/platform-node";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const store = FileSystemCassetteStore.layer().pipe(Layer.provide(NodeServices.layer));

const VcrLive = VcrHttpClient.layer({
  vcrName: "provider-api",
  mode: "auto",
}).pipe(Layer.provide(Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer, store)));
```

Auto mode replays a cassette if it is present. It records one if it is missing.
On CI, a missing cassette fails. `ACK_DISABLE_VCR=*` skips VCR and uses live
HTTP.

Authorization headers are ignored while matching and removed before a cassette
is written. Add other secrets to `redact`.

## Configuration

| Variable          | Required | Default |
| ----------------- | -------- | ------- |
| `CI`              | no       | `false` |
| `ACK_DISABLE_VCR` | no       | empty   |
