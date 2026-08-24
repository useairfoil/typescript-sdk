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
   * The namespace to use for data operations.
   * @example "namespaces/default"
   */
  readonly namespace: string;

  /**
   * Call options accepted by client methods.
   */
  readonly callOptions?: CallOptions;
}

/** @internal Copies caller metadata and enforces the trusted Wings namespace. */
export const withWingsNamespace = (
  callOptions: CallOptions | undefined,
  namespace: string,
): CallOptions => {
  const metadata = Metadata(callOptions?.metadata);
  metadata.set("x-wings-namespace", namespace);
  return { ...callOptions, metadata };
};

/**
 * Creates the WingsClient service implementation from config.
 *
 * @example
 * ```typescript
 * const wingsClient = yield* WingsClient.make({
 *   host: "localhost:7777",
 *   namespace: "namespaces/default"
 * });
 * ```
 */
export const make = Effect.fnUntraced(function* (
  config: WingsClientOptions,
): Effect.fn.Return<WingsClientService, never, Scope.Scope> {
  const mergedCallOptions = withWingsNamespace(config.callOptions, config.namespace);

  const flightClient = yield* ArrowFlightClient.make({
    host: config.host,
    defaultCallOptions: {
      "*": mergedCallOptions,
    },
  });

  const clusterClientConfig: ClusterClientOptions = {
    host: config.host,
    callOptions: mergedCallOptions,
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
