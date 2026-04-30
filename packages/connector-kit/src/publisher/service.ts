import type * as Effect from "effect/Effect";

import { Context } from "effect";

import type { Batch } from "../core/types";
import type { ConnectorError } from "../errors";

export type PublishSource = "live" | "backfill";

export type PublishOptions = {
  readonly name: string;
  readonly source: PublishSource;
  readonly batch: Batch<Record<string, unknown>>;
};

export type PublishAck = {
  readonly success: boolean;
};

export interface PublisherService {
  readonly publish: (options: PublishOptions) => Effect.Effect<PublishAck, ConnectorError>;
}

export class Publisher extends Context.Service<Publisher, PublisherService>()(
  "@useairfoil/connector-kit/Publisher",
) {}
