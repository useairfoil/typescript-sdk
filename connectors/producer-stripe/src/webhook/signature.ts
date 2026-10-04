import { ConnectorError } from "@useairfoil/connector-kit";
import { Clock, Effect } from "effect";
import Stripe from "stripe";

// Makes no requests. Checks every `v1` signature, so secret rotation works.
export const verifySignature = (options: {
  readonly rawBody: Uint8Array;
  readonly header: string | undefined;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.gen(function* () {
    const receivedAt = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        Stripe.webhooks.constructEvent(
          options.rawBody,
          // An empty header fails like a bad signature.
          options.header ?? "",
          options.secret,
          Stripe.webhooks.DEFAULT_TOLERANCE,
          undefined,
          receivedAt,
        ),
      catch: (cause) => new ConnectorError({ message: "Invalid Stripe webhook signature", cause }),
    });
  });
