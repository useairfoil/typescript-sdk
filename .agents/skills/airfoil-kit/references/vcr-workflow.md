# vcr-workflow

VCR captures real HTTP interactions once, then replays them deterministically.

Source of truth:

- `packages/effect-vcr/src/types.ts`
- `packages/effect-vcr/src/cassette-store.ts`
- `packages/effect-vcr/src/file-system-cassette-store.ts`
- `packages/effect-vcr/src/vcr-http-client.ts`

## Real-API verification loop

Use this loop per endpoint you ship.

1. Write a schema in `src/schemas.ts` from docs as a starting point.
2. Write or update `test/api.vcr.test.ts` to call the real endpoint.
3. Switch VCR mode to `"record"` temporarily.
4. Run the test with real credentials from `.env`.
5. Inspect the recorded response body and tighten the schema.
6. Switch VCR mode back to `"replay"`.
7. Re-run the test in replay mode and commit the cassette.

## Correct layer wiring in tests

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
  mode: "replay", // switch to "record" only when recording
}).pipe(Layer.provide(vcrRuntimeLayer));
```

Why this shape:

- `FileSystemCassetteStore.layer()` needs platform filesystem and `Path`
- `VcrHttpClient.layer(...)` needs a live `HttpClient`, `Path`, and a
  cassette store service
- `NodeServices.layer` matters both for the cassette store and for VCR cassette
  name inference in Node tests

## Cassette path and export key

Default inference under Vitest:

- test file: `test/api.vcr.test.ts`
- cassette file: `test/__cassettes__/api.vcr.test.cassette`
- export key: current Vitest test name (`describe > it`)

If `cassetteName` is provided explicitly:

- `users` becomes `users.cassette`
- `users.cassette` stays `users.cassette`

If not running under Vitest, provide `cassetteDir` and `cassetteName`
explicitly.

## Cassette file shape

```json
{
  "exports": {
    "default": {
      "meta": {
        "createdAt": "1970-01-01T00:00:00.000Z",
        "version": "1"
      },
      "entries": {}
    },
    "suite > test name": {
      "meta": {
        "createdAt": "1970-01-01T00:00:00.000Z",
        "version": "1"
      },
      "entries": {
        "<stable-request-key>": {
          "request": { "method": "GET", "url": "..." },
          "response": { "status": 200, "body": "..." }
        }
      }
    }
  }
}
```

`entries` is a record keyed by a stable request key, not an array.

## Modes

| Mode     | Behavior                                        |
| -------- | ----------------------------------------------- |
| `record` | Always call live API, then write cassette entry |
| `replay` | Never call live API, fail if entry missing      |
| `auto`   | Replay when cassette exists; otherwise record   |

CI behavior:

- `CI=true` only affects `auto`
- in `auto`, missing cassette fails in CI instead of recording
- `record` still records even in CI

## `ACK_DISABLE_VCR`

Per-connector bypass uses `VcrConfig.vcrName`:

```bash
ACK_DISABLE_VCR=producer-stripe,producer-shopify pnpm run test
```

Behavior:

- match is case-insensitive after trimming
- if matched, VCR returns the live client directly
- use the same `vcrName` you configured in the layer

## Redaction and matching

Defaults:

- `authorization` is ignored for matching by default
- `authorization` is redacted on write by default

Add service-specific fields when needed:

```ts
VcrHttpClient.layer({
  vcrName: "producer-<service>",
  mode: "replay",
  redact: {
    requestHeaders: ["authorization", "x-api-key"],
    responseHeaders: ["set-cookie"],
    responseBodyKeys: ["secret", "token"],
  },
});
```

Use `matchIgnore` when request fields should not affect cassette identity.

Use `redact` when fields should never be written to disk.

## Rerecording safely

1. Delete the stale cassette file or the stale export key.
2. Switch the test to `mode: "record"`.
3. Run with real credentials.
4. Inspect the diff for sensitive fields.
5. Switch back to `mode: "replay"`.
6. Re-run `test:ci` and commit.

Never manually edit cassette JSON. If secrets leak, fix redaction config,
delete the cassette, and re-record.

## Troubleshooting

- missing replay entry: request shape changed or cassette not recorded yet
- cassette path inference failure: not under Vitest; provide explicit names
- unexpected live call: mode is `auto` and cassette/export missing
- invalid cassette format: regenerate from record mode
