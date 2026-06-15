import type * as Wings from "@useairfoil/wings";
import type * as Effect from "effect/Effect";

import { Context } from "effect";

import type { ResourceBatch } from "../core/types";
import type { ConnectorError } from "../errors";

export type PublishSource = "backfill" | "changes" | "webhook";

export type PublishAck =
  | {
      readonly status: "accepted";
      readonly resource: string;
      readonly partition?: Wings.PartitionValue.PartitionValue;
    }
  | {
      readonly status: "rejected";
      readonly resource: string;
      readonly reason: string;
      readonly rejectedRows?: number;
      readonly partition?: Wings.PartitionValue.PartitionValue;
    };

export type PublishOptions = {
  readonly resource: string;
  readonly source: PublishSource;
  readonly batch: ResourceBatch;
};

export interface PublisherService {
  readonly publish: (options: PublishOptions) => Effect.Effect<PublishAck, ConnectorError>;
}

export class Publisher extends Context.Service<Publisher, PublisherService>()(
  "@useairfoil/connector-kit/Publisher",
) {}
