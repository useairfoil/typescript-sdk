import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { verifySignature } from "../src/webhook/signature";

// A comment delete, signed with `openssl dgst -sha256 -hmac webhook-test-secret`.
const secret = "webhook-test-secret";
const timestamp = 1792144663869;
const rawBody = new TextEncoder().encode(
  `{"action":"remove","type":"Comment","data":{"id":"72fefa63-98bd-4b2d-9d31-4aa23bd49504"},"webhookTimestamp":${timestamp}}`,
);
const signature = "193f4dea2dc3b97cc982eda5842635aa6804dfb9b15f238ea64f92247478a903";

const check = (header: string | undefined, options: { body?: Uint8Array; at?: number } = {}) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(options.at ?? timestamp + 5_000);
    return yield* verifySignature({ rawBody: options.body ?? rawBody, header, secret, timestamp });
  }).pipe(
    Effect.match({
      onFailure: (error) => error.message,
      onSuccess: () => "ok",
    }),
  );

describe("webhook signature", () => {
  it.effect("accepts a fresh signed delivery and rejects everything else", () =>
    Effect.gen(function* () {
      expect({
        signed: yield* check(signature),
        otherBody: yield* check(signature, { body: new TextEncoder().encode("{}") }),
        missing: yield* check(undefined),
        short: yield* check(signature.slice(0, -2)),
        twoMinutesLate: yield* check(signature, { at: timestamp + 120_000 }),
      }).toMatchInlineSnapshot(`
        {
          "missing": "Invalid Linear webhook signature",
          "otherBody": "Invalid Linear webhook signature",
          "short": "Invalid Linear webhook signature",
          "signed": "ok",
          "twoMinutesLate": "Linear webhook is too old",
        }
      `);
    }),
  );
});
