# example-webhook-verification

Illustrative webhook verification patterns for common platforms.
Use these as implementation references only. The target platform's official
webhook docs are the contract source of truth and may require different
algorithms, canonicalization rules, encodings, or replay protections.

All examples assume you receive `rawBody: Uint8Array` (provided by the
kit in the webhook handler) and return
`Effect.Effect<void, ConnectorError>`.

## Stripe

Header: `Stripe-Signature`
Format: `t=<timestamp>,v1=<hex-hmac>`
Scheme: HMAC-SHA256 of `"<timestamp>.<rawBody>"`, hex lowercase.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { Effect } from "effect";
import { ConnectorError } from "@useairfoil/connector-kit";

const verifyStripeSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
  readonly toleranceSeconds?: number;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      const header = Headers.get(options.headers, "stripe-signature");
      if (!header) throw new Error("Missing Stripe-Signature header");
      const parts = Object.fromEntries(
        header.split(",").map((kv) => kv.split("=") as [string, string]),
      );
      const timestamp = Number(parts.t);
      const expected = parts.v1;
      if (!timestamp || !expected) throw new Error("Malformed signature");
      const tolerance = options.toleranceSeconds ?? 300;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > tolerance) {
        throw new Error("Signature timestamp outside tolerance");
      }
      const payload = `${timestamp}.${Buffer.from(options.rawBody).toString("utf8")}`;
      const hmac = createHmac("sha256", options.secret).update(payload).digest();
      const provided = Buffer.from(expected, "hex");
      if (provided.length !== hmac.length || !timingSafeEqual(hmac, provided)) {
        throw new Error("Invalid signature");
      }
    },
    catch: (cause) =>
      new ConnectorError({ message: "Stripe webhook verification failed", cause }),
  });
```

Env: `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`).

## Shopify

Header: `X-Shopify-Hmac-Sha256`
Format: base64-encoded HMAC-SHA256 of the raw body.

```ts
const verifyShopifySignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      const signature = Headers.get(options.headers, "x-shopify-hmac-sha256");
      if (!signature) throw new Error("Missing Shopify signature");
      const hmac = createHmac("sha256", options.secret)
        .update(Buffer.from(options.rawBody))
        .digest();
      const provided = Buffer.from(signature, "base64");
      if (provided.length !== hmac.length || !timingSafeEqual(hmac, provided)) {
        throw new Error("Invalid signature");
      }
    },
    catch: (cause) =>
      new ConnectorError({ message: "Shopify webhook verification failed", cause }),
  });
```

Env: `SHOPIFY_WEBHOOK_SECRET`.

## GitHub

Header: `X-Hub-Signature-256`
Format: `sha256=<hex-hmac>`

```ts
const verifyGithubSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      const signature = Headers.get(options.headers, "x-hub-signature-256");
      if (!signature?.startsWith("sha256=")) {
        throw new Error("Missing or malformed GitHub signature");
      }
      const hmac = createHmac("sha256", options.secret)
        .update(Buffer.from(options.rawBody))
        .digest();
      const provided = Buffer.from(signature.slice("sha256=".length), "hex");
      if (provided.length !== hmac.length || !timingSafeEqual(hmac, provided)) {
        throw new Error("Invalid signature");
      }
    },
    catch: (cause) =>
      new ConnectorError({ message: "GitHub webhook verification failed", cause }),
  });
```

Env: `GITHUB_WEBHOOK_SECRET`.

## Polar (reference)

Polar ships an official verifier. Prefer it over rolling your own.

```ts
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

const verifyPolarSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      validateEvent(
        Buffer.from(options.rawBody),
        options.headers,
        options.secret,
      );
    },
    catch: (error) =>
      new ConnectorError({
        message:
          error instanceof WebhookVerificationError
            ? "Invalid Polar webhook signature"
            : "Failed to validate Polar webhook",
        cause: error,
      }),
  });
```

See `connectors/producer-polar/src/connector.ts` for the live version.

## Slack

Header: `X-Slack-Signature` + `X-Slack-Request-Timestamp`
Format: `v0=<hex-hmac>`; HMAC over `"v0:<timestamp>:<rawBody>"`.

```ts
const verifySlackSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      const signature = Headers.get(options.headers, "x-slack-signature");
      const timestamp = Headers.get(options.headers, "x-slack-request-timestamp");
      if (!signature || !timestamp) throw new Error("Missing Slack headers");
      if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
        throw new Error("Slack timestamp outside tolerance");
      }
      const base = `v0:${timestamp}:${Buffer.from(options.rawBody).toString("utf8")}`;
      const hmac = createHmac("sha256", options.secret).update(base).digest();
      const provided = Buffer.from(signature.slice("v0=".length), "hex");
      if (provided.length !== hmac.length || !timingSafeEqual(hmac, provided)) {
        throw new Error("Invalid Slack signature");
      }
    },
    catch: (cause) =>
      new ConnectorError({ message: "Slack webhook verification failed", cause }),
  });
```

## General HMAC template

If your target isn't listed, figure out these three things from the
docs:

1. Which header carries the signature?
2. What exactly is signed (raw body? body + timestamp? URL?)
3. Is it hex or base64 encoded?

Plug into:

```ts
const verifyGeneric = (options) =>
  Effect.try({
    try: () => {
      const hmac = createHmac(
        "sha256", // or "sha1" if the API is old; sha256 is the default
        options.secret,
      )
        .update(Buffer.from(options.rawBody)) // or the documented canonical string
        .digest();
      const provided = Buffer.from(options.signature, "hex"); // or "base64"
      if (provided.length !== hmac.length || !timingSafeEqual(hmac, provided)) {
        throw new Error("Invalid signature");
      }
    },
    catch: (cause) => new ConnectorError({ message: "...", cause }),
  });
```

## Always

- Use `createHmac` (not `crypto.createHash`) for keyed HMACs.
- Use `timingSafeEqual` — **never** `===` or `Buffer.compare` for
  signature comparison.
- Verify **before** decoding the payload.
- Treat the signing secret as `Redacted.make(secret)` anywhere it
  touches logs.
- Map every failure to `ConnectorError` so the handler's error channel
  stays narrow.
- Gate on the raw body being present; if the transport lost it, fail
  loudly.

## Timestamp tolerance

Most schemes include a timestamp to prevent replay attacks. Use the
platform's documented tolerance (usually 5 minutes). A sample clock-skew
check:

```ts
if (Math.abs(Date.now() / 1000 - timestamp) > tolerance) {
  throw new Error("Signature timestamp outside tolerance");
}
```

Document the tolerance choice in the connector README if it's
non-default.

## What to test

For each connector, ship two webhook tests:

1. **Valid signature** — assert 200 and a published batch.
2. **Invalid signature** — assert 500 (or the chosen rejection status)
   and **no** published batch.

Both tests drive `NodeHttpServer.layerTest` + `Effect.forkScoped(runConnector)`
per `webhooks.md`.
