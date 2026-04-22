import type * as Effect from "effect/Effect";

import * as ServiceMap from "effect/ServiceMap";

import type { ConnectorError } from "../core/errors";
import type { Batch } from "../core/types";

export type PublishAck = {
  readonly success: boolean;
};

export class Publisher extends ServiceMap.Service<
  Publisher,
  {
    readonly publish: (options: {
      readonly name: string;
      readonly batch: Batch<Record<string, unknown>>;
    }) => Effect.Effect<PublishAck, ConnectorError>;
  }
>()("Publisher") {}
