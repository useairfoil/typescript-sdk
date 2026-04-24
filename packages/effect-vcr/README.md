# @useairfoil/effect-vcr

An HttpClient for Effect that records all HTTP interactions and stores them on tape, ready to be replayed for future test runs.

The first time the following test is run, it sends the HTTP request to httpbin.org and stores the request/response pair to a cassette. All subsequent tests will replay the response from the cassette, making no HTTP requests.

```ts
// my-program.ts
export const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.get("https://httpbin.org");
  return yield* response.text;
});

// my-program.test.ts
import { VcrHttpClient, FileSystemCassetteStore } from "@useairfoil/effect-vcr";

describe("my awesome program", () => {
  it.effect("works", () =>
    Effect.gen(function* () {
      yield* program;
    }),
  ).pipe(
    // Wrap the HttpClient with the VCR
    Effect.provide(VcrHttpClient.layer()),
    // Store cassettes on the file system
    Effect.provide(FileSystemCassetteStore.layer()),
    // HttpClient based on fetch
    Effect.provide(FetchHttpClient.layer),
    // Node is used to access the file system
    Effect.provide(NodeServices.layer),
  );
});
```

The main use case for the VCR is to allow open source projects to run tests against a real API endpoint without exposing secrets to forks.

- Project owners generate cassettes locally by interacting with the upstream API
- External contributors run their tests using the cassettes
- CI runs using cassettes
- Optionally, CI runs against the upstream API periodically, to catch any schema drift

## Usage

Use the VCR by providing the VcrHttpClient and FileSystemCassetteStore layers to the Effect being tested.

- VcrHttpClient: this HttpClient wraps another HttpClient, adding support for recording and replaying HTTP interactions.
- FileSystemCassetteStore: stores cassettes on the file system.

## Configuration and defaults

### VcrHttpClient

- `vcrName?: string`: the VCR name. Used to selectively disable VCRs during test runs (more on this in the runtime configuration section).
- `cassetteName?: string`: the cassette name. If not set, defaults to the current vitest file name.
- `mode: "record" | "replay" | "auto"`: controls the VCR behaviour. Defaults to `auto`.
  - `record`: always call the live client and write a cassette.
  - `replay`: only serve from cassette; missing entries fail.
  - `auto`: replay if cassette exists, otherwise record. If `CI=true`, missing cassette fails.
- `redact`: control which sensitive headers and JSON body keys to remove from requests and responses.
  - `.requestHeaders?: string[]`: redact the specified request headers.
  - `.responseHeaders?: string[]`: redact the specified response headers.
  - `.requestBodyKeys?: string[]`: redact the specified request JSON keys.
  - `.responseBodyKeys?: string[]`: redact the specified response JSON keys.
- `matchIgnore`: control which fields are ignored when matching requests.
  - `.requestHeaders?: string[]`: ignore the specified request headers.
  - `.requestBodyKeys?: string[]`: ignore the specified request JSON keys.
- `match: (request: VcrRequest, entry: VcrEntry) => boolean`: custom request to entry matcher.

### FileSystemCassetteStore

- `cassetteDir?: string`: change the location of the cassette. By default, the VCR stores cassettes in the `__cassettes__` folder next to the test.

## Runtime configuration

The VCR is controlled by the following environment variables:

- `CI=true`: if set and the VCR mode is `auto`, tests with a missing cassette fail.
- `ACK_DISABLE_VCR=<...>`: disable the VCR. If `'*'`, then all VCRs are disabled. To selectively disable VCRs, pass a comma separated list of VCRs to disable (based on their `vcrName` config). Use this to test against the upstream API. In this case, the cassettes are not updated.
