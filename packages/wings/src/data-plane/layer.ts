import { ArrowFlightClient, createChannelFromConfig } from "@useairfoil/flight";
import { Config, Effect, Layer, Scope } from "effect";
import { Metadata } from "nice-grpc";
import type { CallOptions } from "nice-grpc-common";
import type { ClusterMetadataParams } from "../cluster-metadata/config";
import { make as makeClusterMetadata } from "../cluster-metadata/layer";
import * as FetcherModule from "./fetcher";
import * as PublisherModule from "./publisher";
import { WingsClient, type WingsClientService } from "./service";

/**
 * Configuration for WingsClient
 */
export interface WingsClientParams {
  /**
   * The gRPC host address
   * @example "localhost:7777"
   * @example "wings.example.com:7777"
   */
  readonly host: string;

  /**
   * The namespace to use for data operations
   * @example "tenants/default/namespaces/default"
   */
  readonly namespace: string;

  /**
   * Call options accepted by client methods.
   */
  readonly callOptions?: CallOptions;
}

/**
 * Creates the WingsClient service implementation from config.
 *
 * @example
 * ```typescript
 * const wingsClient = yield* WingsClient.make({
 *   host: "localhost:7777",
 *   namespace: "tenants/default/namespaces/default"
 * });
 * ```
 */
export const make = (
  config: WingsClientParams,
): Effect.Effect<WingsClientService, never, Scope.Scope> =>
  Effect.gen(function* () {
    const channel = createChannelFromConfig({ host: config.host });

    const metadata = Metadata({
      "x-wings-namespace": config.namespace,
    });

    const mergedCallOptions: CallOptions = {
      ...config.callOptions,
      metadata,
    };

    const flightClient = new ArrowFlightClient(
      { channel },
      {
        defaultCallOptions: {
          "*": mergedCallOptions,
        },
      },
    );

    const clusterMetadataConfig: ClusterMetadataParams = {
      host: config.host,
      callOptions: config.callOptions,
    };

    const clusterMetadata = yield* makeClusterMetadata(clusterMetadataConfig);

    const layerScope = yield* Effect.scope;

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        channel.close();
      }),
    );

    return {
      flightClient,
      clusterMetadata,
      fetch: (options) => FetcherModule.fetch(flightClient, options),
      publisher: (options) =>
        PublisherModule.makePublisher(flightClient, options).pipe(
          Scope.provide(layerScope),
        ),
    };
  });

/** Create layer with direct config values */
export const layer = (config: WingsClientParams): Layer.Layer<WingsClient> =>
  Layer.effect(WingsClient, make(config));

/**
 * Create layer with Effect Config (for env vars, etc.)
 *
 * @example
 * WingsClient.layerConfig({
 *   host: Config.string("WINGS_URL"),
 *   namespace: Config.string("WINGS_NAMESPACE")
 * })
 */
export const layerConfig = (config: Config.Wrap<WingsClientParams>) =>
  Layer.effect(
    WingsClient,
    Effect.gen(function* () {
      const params = yield* Config.unwrap(config);
      return yield* make(params);
    }),
  );
