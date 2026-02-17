/** biome-ignore-all lint/suspicious/noExplicitAny: Effect schema is invariant. */
import type { HttpRouter, HttpServerRequest } from "@effect/platform";
import type { Effect, Queue, Schema } from "effect";
import type { ConnectorError } from "../core/errors";
import type { Batch } from "../core/types";

export type WebhookDispatch<T> = {
  readonly queue: Queue.Queue<Batch<T>>;
  readonly batch: Batch<T>;
};

export type WebhookRoute<T> = {
  readonly path: HttpRouter.PathInput;
  readonly schema: Schema.Schema<T, any, any>;
  readonly dispatch: (
    payload: T,
    request: HttpServerRequest.HttpServerRequest,
  ) => Effect.Effect<ReadonlyArray<WebhookDispatch<T>>, ConnectorError>;
};
