import { ConnectorError } from "@useairfoil/connector-kit";
import { Effect } from "effect";
import { createHmac, timingSafeEqual } from "node:crypto";

const prefix = "sha256=";

export const verifySignature = (options: {
  readonly rawBody: Uint8Array;
  readonly header: string | undefined;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> => {
  const header = options.header ?? "";
  const expected = createHmac("sha256", options.secret).update(options.rawBody).digest();
  const provided = Buffer.from(header.slice(prefix.length), "hex");
  return header.startsWith(prefix) &&
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
    ? Effect.void
    : Effect.fail(new ConnectorError({ message: "Invalid GitHub webhook signature" }));
};
