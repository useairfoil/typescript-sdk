import type { ArrowFlightClientService } from "@useairfoil/flight";
import type { RecordBatch } from "apache-arrow";

import { Context, type Effect, type Stream } from "effect";

import type * as ClusterSchema from "../cluster";
import type { ClusterClientService } from "../cluster-client/service";
import type { WingsError } from "../errors";
import type { PartitionValue } from "../partition-value";
import type { Publisher } from "./publisher";

export interface FetchOptions {
  readonly topic: ClusterSchema.Topic.Topic;
  readonly partitionValue?: PartitionValue;
  readonly offset?: bigint;
  readonly minBatchSize?: number;
  readonly maxBatchSize?: number;
}

export interface PublisherOptions {
  readonly topic: ClusterSchema.Topic.Topic;
  readonly partitionValue?: PartitionValue;
}

/**
 * Main service for working with the Wings data plane.
 */
export interface WingsClientService {
  /**
   * Low-level Flight client for advanced integrations.
   */
  readonly flightClient: ArrowFlightClientService;

  /**
   * Cluster metadata client that shares the same runtime configuration.
   */
  readonly clusterClient: ClusterClientService;

  readonly fetch: (
    options: FetchOptions,
  ) => Effect.Effect<Stream.Stream<RecordBatch, WingsError>, never>;

  /**
   * Creates a publisher for pushing data to a topic.
   * The publisher's background fiber is supervised by the WingsClient layer
   */
  readonly publisher: (options: PublisherOptions) => Effect.Effect<Publisher, WingsError>;
}

export class WingsClient extends Context.Service<WingsClient, WingsClientService>()(
  "@useairfoil/wings/WingsClient",
) {}

export const fetch = (
  options: FetchOptions,
): Effect.Effect<Stream.Stream<RecordBatch, WingsError>, WingsError, WingsClient> =>
  WingsClient.use((service) => service.fetch(options));

export const clusterClient: Effect.Effect<ClusterClientService, never, WingsClient> =
  WingsClient.useSync((service) => service.clusterClient);

export const flightClient: Effect.Effect<ArrowFlightClientService, never, WingsClient> =
  WingsClient.useSync((service) => service.flightClient);

/**
 * Creates a publisher for pushing batches into a topic.
 */
export const publisher = (
  options: PublisherOptions,
): Effect.Effect<Publisher, WingsError, WingsClient> =>
  WingsClient.use((service) => service.publisher(options));
