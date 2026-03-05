/** biome-ignore-all lint/suspicious/noExplicitAny: Effect Schema encodes invariantly; `any` on the encoded type is intentional. */

import type { Effect } from "effect";
import type * as Schema from "effect/Schema";
import type { HttpRouter, HttpServerRequest } from "effect/unstable/http";
import type { ConnectorError } from "../core/errors";

export type WebhookRoute<TPayload> = {
  readonly path: HttpRouter.PathInput;
  readonly schema: Schema.Schema<TPayload>;
  readonly handle: (
    payload: TPayload,
    request: HttpServerRequest.HttpServerRequest,
    rawBody?: Uint8Array,
  ) => Effect.Effect<void, ConnectorError>;
};
