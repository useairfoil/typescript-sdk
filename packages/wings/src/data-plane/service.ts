import type { ArrowFlightClient } from "@airfoil/flight";
import type { RecordBatch } from "apache-arrow";
import { Context, Effect, type Stream } from "effect";
import type { ClusterMetadataService } from "../cluster-metadata/service";
import type { WingsError } from "../errors";
import type { PartitionValue } from "../partition-value";
import type * as WS from "../schema";
import type { Publisher } from "./publisher";

export interface FetchOptions {
  readonly topic: WS.Topic.Topic;
  readonly partitionValue?: PartitionValue;
  readonly offset?: bigint;
  readonly minBatchSize?: number;
  readonly maxBatchSize?: number;
}

export interface PublisherOptions {
  readonly topic: WS.Topic.Topic;
  readonly partitionValue?: PartitionValue;
}

/**
 * WingsClient Service Interface
 */
export interface WingsClientService {
  /**
   * Low-level Arrow Flight client used by fetcher and publisher.
   * Exposed for advanced use cases where you need direct Flight access.
   */
  readonly flightClient: ArrowFlightClient;

  /**
   * Effect-based ClusterMetadata service for managing tenants, namespaces,
   * topics, object stores and data lakes.
   */
  readonly clusterMetadata: ClusterMetadataService;

  readonly fetch: (
    options: FetchOptions,
  ) => Stream.Stream<RecordBatch, WingsError>;

  /**
   * Creates a publisher for pushing data to a topic.
   * The publisher's background fiber is supervised by the WingsClient layer
   */
  readonly publisher: (
    options: PublisherOptions,
  ) => Effect.Effect<Publisher, WingsError>;
}

export class WingsClient extends Context.Tag("@airfoil/wings/WingsClient")<
  WingsClient,
  WingsClientService
>() {}

export const fetch = (
  options: FetchOptions,
): Effect.Effect<Stream.Stream<RecordBatch, WingsError>, never, WingsClient> =>
  Effect.map(WingsClient, (service) => service.fetch(options));

export const clusterMetadata = (): Effect.Effect<
  ClusterMetadataService,
  never,
  WingsClient
> => Effect.map(WingsClient, (service) => service.clusterMetadata);

export const flightClient = (): Effect.Effect<
  ArrowFlightClient,
  never,
  WingsClient
> => Effect.map(WingsClient, (service) => service.flightClient);

/**
 * Creates a publisher for pushing data to a topic.
 * The publisher's background fiber is supervised by the WingsClient layer.
 */
export const publisher = (
  options: PublisherOptions,
): Effect.Effect<Publisher, WingsError, WingsClient> =>
  Effect.flatMap(WingsClient, (service) => service.publisher(options));
