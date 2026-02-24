/** biome-ignore-all lint/suspicious/noExplicitAny: Effect Schema encodes invariantly; `any` on the encoded type is intentional. */
import type { HttpRouter, HttpServerRequest } from "@effect/platform";
import type { Effect, Schema } from "effect";
import type { ConnectorError } from "../core/errors";

export type WebhookRoute<TPayload> = {
  readonly path: HttpRouter.PathInput;
  readonly schema: Schema.Schema<TPayload, any, never>;
  readonly handle: (
    payload: TPayload,
    request: HttpServerRequest.HttpServerRequest,
    rawBody?: Uint8Array,
  ) => Effect.Effect<void, ConnectorError>;
};
