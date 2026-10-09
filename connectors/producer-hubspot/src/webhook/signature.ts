import { ConnectorError } from "@useairfoil/connector-kit";
import { Clock, Effect } from "effect";
import { createHmac, timingSafeEqual } from "node:crypto";

const maxAge = 5 * 60 * 1000;

// HubSpot decodes only these characters before signing the URL.
const decodeUrl = (url: string) =>
  url.replace(/%(3A|2F|3F|40|21|24|27|28|29|2A|2C|3B)/gi, (code) => decodeURIComponent(code));

/**
 * Checks `X-HubSpot-Signature-v3`: a base64 HMAC-SHA256 of the method, full
 * URL, raw body, and timestamp, keyed with the app's client secret.
 */
export const verifySignature = (options: {
  readonly method: string;
  readonly url: string;
  readonly rawBody: Uint8Array;
  readonly signature: string | undefined;
  readonly timestamp: string | undefined;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.gen(function* () {
    const timestamp = Number(options.timestamp);
    const now = yield* Clock.currentTimeMillis;
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > maxAge) {
      return yield* new ConnectorError({
        message: "HubSpot webhook timestamp is missing or too old",
      });
    }
    const expected = createHmac("sha256", options.secret)
      .update(options.method)
      .update(decodeUrl(options.url))
      .update(options.rawBody)
      .update(options.timestamp ?? "")
      .digest();
    const provided = Buffer.from(options.signature ?? "", "base64");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return yield* new ConnectorError({ message: "Invalid HubSpot webhook signature" });
    }
  });
