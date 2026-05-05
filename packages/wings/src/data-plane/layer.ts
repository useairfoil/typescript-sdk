import type { CallOptions } from "nice-grpc-common";

import { ArrowFlightClient } from "@useairfoil/flight";
import { Config, Effect, Layer, Scope } from "effect";
import { Metadata } from "nice-grpc";

import type { ClusterClientOptions } from "../cluster-client/config";

import { make as makeClusterClient } from "../cluster-client/layer";
import * as FetcherModule from "./fetcher";
import * as PublisherModule from "./publisher";
import { WingsClient, type WingsClientService } from "./service";

/**
 * Configuration for WingsClient
 */
export interface WingsClientOptions {
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
export const make = Effect.fnUntraced(function* (
  config: WingsClientOptions,
): Effect.fn.Return<WingsClientService, never, Scope.Scope> {
  const metadata = Metadata({
    "x-wings-namespace": config.namespace,
  });

  const mergedCallOptions: CallOptions = {
    ...config.callOptions,
    metadata,
  };

  const flightClient = yield* ArrowFlightClient.make({
    host: config.host,
    defaultCallOptions: {
      "*": mergedCallOptions,
    },
  });

  const clusterClientConfig: ClusterClientOptions = {
    host: config.host,
    callOptions: config.callOptions,
  };

  const clusterClient = yield* makeClusterClient(clusterClientConfig);

  const layerScope = yield* Effect.scope;

  return {
    flightClient,
    clusterClient,
    fetch: (options) => FetcherModule.fetch(flightClient, options),
    publisher: (options) =>
      PublisherModule.makePublisher(flightClient, options).pipe(Scope.provide(layerScope)),
  };
});

/** Create layer with direct config values */
export const layer = (config: WingsClientOptions): Layer.Layer<WingsClient> =>
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
export const layerConfig = (config: Config.Wrap<WingsClientOptions>) =>
  Layer.effect(
    WingsClient,
    Effect.gen(function* () {
      const params = yield* Config.unwrap(config);
      return yield* make(params);
    }),
  );
