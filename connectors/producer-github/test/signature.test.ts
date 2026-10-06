import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { verifySignature } from "../src/webhook/signature";

// The example from GitHub's "Validating webhook deliveries" guide.
const secret = "It's a Secret to Everybody";
const rawBody = new TextEncoder().encode("Hello, World!");
const signature = "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";

const check = (header: string | undefined, body = rawBody) =>
  verifySignature({ rawBody: body, header, secret }).pipe(
    Effect.match({
      onFailure: (error) => error.message,
      onSuccess: () => "ok",
    }),
  );

describe("webhook signature", () => {
  it.effect("accepts GitHub's example and rejects everything else", () =>
    Effect.gen(function* () {
      expect({
        github: yield* check(signature),
        otherBody: yield* check(signature, new TextEncoder().encode("Hello, World")),
        missing: yield* check(undefined),
        sha1: yield* check(signature.replace("sha256=", "sha1=")),
        short: yield* check(signature.slice(0, -2)),
      }).toMatchInlineSnapshot(`
        {
          "github": "ok",
          "missing": "Invalid GitHub webhook signature",
          "otherBody": "Invalid GitHub webhook signature",
          "sha1": "Invalid GitHub webhook signature",
          "short": "Invalid GitHub webhook signature",
        }
      `);
    }),
  );
});
