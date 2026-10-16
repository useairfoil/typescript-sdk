import { ConnectorError } from "@useairfoil/connector-kit";
import { DateTime, Effect } from "effect";
import { createHmac, timingSafeEqual } from "node:crypto";

// Linear suggests rejecting deliveries more than a minute old, to stop replays.
const maxAgeMillis = 60_000;

export const verifySignature = (options: {
  readonly rawBody: Uint8Array;
  readonly header: string | undefined;
  readonly secret: string;
  /** `webhookTimestamp` from the body, in milliseconds. */
  readonly timestamp: number | undefined;
}): Effect.Effect<void, ConnectorError> =>
  Effect.gen(function* () {
    const expected = createHmac("sha256", options.secret).update(options.rawBody).digest();
    const provided = Buffer.from(options.header ?? "", "hex");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return yield* new ConnectorError({ message: "Invalid Linear webhook signature" });
    }
    const now = yield* DateTime.nowAsDate;
    if (
      options.timestamp === undefined ||
      Math.abs(now.getTime() - options.timestamp) > maxAgeMillis
    ) {
      return yield* new ConnectorError({ message: "Linear webhook is too old" });
    }
  });
