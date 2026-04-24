# vcr-workflow

VCR captures real HTTP interactions once, then replays them in CI.

Source of truth:

- `packages/effect-http-client/src/types.ts`
- `packages/effect-http-client/src/vcr-http-client.ts`

## Real-API verification loop

Use this loop per entity endpoint you ship.

1. Write a schema in `src/schemas.ts` from docs as a starting point.
2. Write/update `test/api.vcr.test.ts` to call the real endpoint.
3. Set VCR mode to `"record"` temporarily.
4. Run test with real credentials from `.env`.
5. Inspect cassette response body and tighten schema fields.
6. Switch VCR mode back to `"replay"`.
7. Re-run test (replay-only) and commit cassette.

## Correct layer wiring in tests

```ts
import { NodeFileSystem, NodeHttpClient } from "@effect/platform-node";
import {
  CassetteStoreLive,
  VcrHttpClientLayer,
} from "@useairfoil/effect-http-client";
import { Layer } from "effect";

const cassetteLayer = CassetteStoreLive.pipe(
  Layer.provide(NodeFileSystem.layer),
);

const vcrLayer = VcrHttpClientLayer({
  connectorName: "producer-<service>",
  mode: "replay", // switch to "record" only when recording
}).pipe(
  Layer.provide(Layer.mergeAll(NodeHttpClient.layerFetch, cassetteLayer)),
);
```

Do not omit `CassetteStoreLive`; VCR needs both `HttpClient` and `CassetteStore`.

## Cassette path and export key

Default inference under Vitest:

- test file: `test/api.vcr.test.ts`
- cassette file: `test/__cassettes__/api.vcr.test.ts.cassette`
- export key: current Vitest test name (`describe > it`)

If not running under Vitest state, pass `cassetteDir` + `cassetteName` explicitly.

## Cassette file shape (current)

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

| Mode | Behavior |
| --- | --- |
| `record` | Always call live API, then write cassette entry |
| `replay` | Never call live API, fail if entry missing |
| `auto` | Replay when cassette exists; otherwise record |

CI behavior:

- `CI=true` only affects `auto` mode.
- In `auto`, missing cassette fails in CI instead of recording.
- `record` still records even in CI.

## `ACK_DISABLE_VCR`

Per-connector bypass uses `VcrConfig.connectorName`:

```bash
ACK_DISABLE_VCR=producer-stripe,producer-shopify bun --env-file=.env vitest
```

Behavior:

- Match is case-insensitive after trimming.
- If matched, VCR returns the live client directly (no cassette read/write).
- Use full connector names (`producer-stripe`, not just `stripe`).

## Redaction and matching

Defaults:

- `authorization` is ignored for matching by default.
- `authorization` is redacted by default on write.

Add service-specific headers/keys when needed:

```ts
VcrHttpClientLayer({
  connectorName: "producer-<service>",
  mode: "replay",
  redact: {
    requestHeaders: ["authorization", "x-api-key"],
    responseHeaders: ["set-cookie"],
    responseBodyKeys: ["secret", "token"],
  },
});
```

## Rerecording safely

1. Delete stale cassette file (or stale export key).
2. Switch test to `mode: "record"`.
3. Run with real credentials.
4. Inspect diff for sensitive fields.
5. Switch back to `mode: "replay"`.
6. Re-run `test:ci` and commit.

Never manually edit cassette JSON. If secrets leak, fix redaction config,
delete the cassette, and re-record.

## Troubleshooting

- **Missing replay entry**: request shape changed (URL/body/header key mismatch)
  or cassette not recorded yet.
- **Cassette path inference failure**: not under Vitest; provide path/name.
- **Unexpected live call**: mode is `auto` and cassette/export missing.
- **Invalid cassette format**: regenerate cassette from record mode.
