import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { ConnectorError } from "../core/errors";
import type { Batch } from "../core/types";

export type PublishAck = {
  readonly requestId: bigint;
};

// TODO: Wings integration
export class Publisher extends Context.Tag("Publisher")<
  Publisher,
  {
    readonly publish: <T>(options: {
      readonly name: string;
      readonly batch: Batch<T>;
    }) => Effect.Effect<PublishAck, ConnectorError>;
  }
>() {}
