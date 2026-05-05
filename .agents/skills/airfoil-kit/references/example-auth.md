# example-auth

Auth patterns expressed as Effect `Config` + `HttpClient.mapRequest`.
All patterns plug into the current `make(config)` / `layer(config)` API client
shape from `api.ts`. Nothing here requires changes to the connector kit.

These are illustrative implementation patterns, not a protocol contract.
Always implement authentication according to official platform docs for the
target service.

## Bearer token (Polar, Stripe, GitHub v4, most modern APIs)

**Config**:

```ts
export const XConfigConfig = Config.all({
  apiBaseUrl: Config.string("X_API_BASE_URL"),
  accessToken: Config.string("X_ACCESS_TOKEN"),
});
```

**HttpClient wiring** (inside `api.ts`):

```ts
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { Redacted } from "effect";

export const make = Effect.fnUntraced(function* (
  config: XConfig,
): Effect.fn.Return<XApiClientService, ConnectorError, HttpClient.HttpClient> {
  const httpClient = yield* HttpClient.HttpClient;
  const client = httpClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
    HttpClient.mapRequest(HttpClientRequest.bearerToken(Redacted.make(config.accessToken))),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
  );
  // ... fetchJson, fetchList built from client
});

export const layer = (config: XConfig) => Layer.effect(XApiClient)(make(config));
```

Notes:

- `Redacted.make(...)` wraps the token so it doesn't appear in logs.
- `HttpClientRequest.bearerToken` sets `Authorization: Bearer <token>`.
  The VCR layer redacts this header by default.

## API key in a custom header

For services like Anthropic (`x-api-key`), SendGrid (`Authorization:
Bearer`), Twilio (basic), etc. — the shape is the same, only the
header name changes.

```ts
const client = httpClient.pipe(
  HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
  HttpClient.mapRequest(HttpClientRequest.setHeader("x-api-key", config.apiKey)),
  HttpClient.mapRequest(HttpClientRequest.acceptJson),
);
```

**Redact** the custom header in tests:

```ts
VcrHttpClient.layer({
  vcrName: "producer-x",
  redact: { requestHeaders: ["authorization", "x-api-key"] },
});
```

## Basic auth (Twilio, Jira on-prem)

```ts
HttpClient.mapRequest(
  HttpClientRequest.basicAuth(config.accountSid, Redacted.make(config.authToken)),
);
```

Config:

```ts
export const XConfigConfig = Config.all({
  apiBaseUrl: Config.string("X_API_BASE_URL"),
  accountSid: Config.string("X_ACCOUNT_SID"),
  authToken: Config.string("X_AUTH_TOKEN"),
});
```

## OAuth2 with long-lived refresh token

The MVP pattern: store a refresh token in `.env`, exchange it on startup,
keep the access token in a `Ref`.

```ts
type TokenState = { accessToken: string; expiresAt: number };

export class XOAuthTokens extends Context.Service<XOAuthTokens, Ref.Ref<TokenState>>()(
  "@useairfoil/producer-x/XOAuthTokens",
) {}

export const layerOAuthTokens = (config: XConfig) =>
  Layer.effect(XOAuthTokens)(
    Effect.fnUntraced(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      const initial = yield* exchangeRefreshToken(httpClient, config);
      return yield* Ref.make(initial);
    })(),
  );
```

On 401, refresh and retry. The cleanest way is to wrap the client:

```ts
const clientWithRefresh = Effect.gen(function* () {
  const tokens = yield* XOAuthTokens;
  const base = yield* HttpClient.HttpClient;
  const withBearer = (accessToken: string) =>
    base.pipe(HttpClient.mapRequest(HttpClientRequest.bearerToken(Redacted.make(accessToken))));
  return {
    execute: (request: HttpClientRequest.HttpClientRequest) =>
      Effect.gen(function* () {
        const current = yield* Ref.get(tokens);
        const first = yield* withBearer(current.accessToken).execute(request);
        if (first.status !== 401) return first;
        const fresh = yield* exchangeRefreshToken(base, config);
        yield* Ref.set(tokens, fresh);
        return yield* withBearer(fresh.accessToken).execute(request);
      }),
  };
});
```

Surface to the user: "For the MVP I'm using a static refresh token from
`.env`. If you need full OAuth2 with user redirect, I need to know your
redirect URI and where to store tokens."

## Signed-request auth (AWS SigV4, some enterprise APIs)

Use the platform's signing library (`@aws-sdk/signature-v4`, etc.) and
wrap as an `HttpClient.mapRequestEffect`:

```ts
HttpClient.mapRequestEffect((request) =>
  Effect.tryPromise({
    try: () => signer.sign(request),
    catch: (cause) => new ConnectorError({ message: "SigV4 signing failed", cause }),
  }),
);
```

- Use `mapRequestEffect` (not `mapRequest`) because signing is async.
- Never roll your own SigV4 — use the vendor library.

## Per-tenant credentials

When a single connector instance serves multiple tenants (rare but
possible):

```ts
export const XConfigConfig = Config.all({
  apiBaseUrl: Config.string("X_API_BASE_URL"),
  tenantTokens: Config.hashMap(Config.string(), "X_TENANT_TOKENS"), // "alice=t1,bob=t2"
});
```

- Choose the token at request time based on some tenant context.
- Requires a per-request layer wrapping the HttpClient. Complex — push
  back on the user if you can scope to one tenant per connector
  instance.

## Sandbox vs production

Two common shapes:

1. **Different URL, same token format** (Polar):

   ```
   X_API_BASE_URL=https://sandbox-api.x.com/v1/   # default
   X_API_BASE_URL=https://api.x.com/v1/           # production
   ```

   One env var toggles environments.

2. **Same URL, token prefix differentiates** (Stripe):
   ```
   STRIPE_API_KEY=sk_test_...  # test mode
   STRIPE_API_KEY=sk_live_...  # live
   ```
   No URL change; the key tells the platform which mode.

Document which model your connector uses in README.

## Redacted logging

Always wrap secrets in `Redacted.make(secret)` when passing through
`HttpClientRequest.bearerToken` / `basicAuth` / custom headers. Effect's
logger will render these as `<redacted>` and error messages won't leak
them.

## What NOT to do

- Don't read `process.env` in `api.ts` or elsewhere. Use `Config`.
- Don't embed tokens in cassettes. The `authorization` header is
  redacted by default, but custom headers need explicit redaction.
- Don't skip Bearer for "easier" querystring auth (`?api_key=...`).
  Query strings leak in logs and cassettes.
- Don't store tokens globally. The token is part of the `Config`
  struct, not module-level state.

## Decision matrix

| API signal                          | Pattern                               |
| ----------------------------------- | ------------------------------------- |
| `Authorization: Bearer <token>`     | Bearer token                          |
| Custom header with token            | API key header                        |
| `user:pass` base64 in Authorization | Basic auth                            |
| OAuth2 with refresh                 | Refresh-on-401 via Ref                |
| AWS / GCP signed requests           | Platform library + `mapRequestEffect` |
| Short-lived STS tokens              | Refresh-on-401 with ambient provider  |
