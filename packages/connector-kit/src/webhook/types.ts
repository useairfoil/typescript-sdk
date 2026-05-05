/** biome-ignore-all lint/suspicious/noExplicitAny: Effect Schema encodes invariantly; `any` on the encoded type is intentional. */

import type { Effect } from "effect";
import type * as Schema from "effect/Schema";
import type { HttpRouter, HttpServerRequest } from "effect/unstable/http";

import type { ConnectorError } from "../errors";

export type WebhookRoute<S extends Schema.Schema<any> = Schema.Schema<any>> = {
  readonly path: HttpRouter.PathInput;
  readonly schema: S;
  readonly handle: (
    payload: Schema.Schema.Type<S>,
    request: HttpServerRequest.HttpServerRequest,
    rawBody?: Uint8Array,
  ) => Effect.Effect<void, ConnectorError>;
};
