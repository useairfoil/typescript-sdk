import { createChannelFromConfig } from "@useairfoil/flight";
import { Config, Effect, Layer, Scope } from "effect";
import { type CallOptions, createClient } from "nice-grpc";

import type { ClusterClientOptions } from "./config";

import * as ClusterSchema from "../cluster";
import { ClusterClientError } from "../errors";
import { type ClusterServiceClient, ClusterServiceDefinition } from "../proto/wings/cluster";
import { ClusterClient, type ClusterClientService } from "./service";

/**
 * Creates the ClusterClient service implementation from config.
 *
 * @example
 * ```typescript
 * const clusterClient = yield* ClusterClient.make({
 *   host: "localhost:7000"
 * });
 * ```
 */
export const make = Effect.fnUntraced(function* (
  config: ClusterClientOptions,
): Effect.fn.Return<ClusterClientService, never, Scope.Scope> {
  const channel = createChannelFromConfig({ host: config.host });
  const grpcClient: ClusterServiceClient = createClient(ClusterServiceDefinition, channel);

  const scope = yield* Scope.Scope;
  yield* Scope.addFinalizer(
    scope,
    Effect.sync(() => {
      channel.close();
    }),
  );

  const makeGrpcCall =
    <Req, ProtoReq, ProtoRes, Res>(
      grpcMethod: (req: ProtoReq, options?: CallOptions) => Promise<ProtoRes>,
      toProto: (req: Req) => ProtoReq,
      fromProto: (res: ProtoRes) => Res,
    ) =>
    (req: Req, options?: CallOptions) =>
      Effect.tryPromise({
        try: async () => {
          const protoReq = toProto(req);
          const mergedOptions =
            config.callOptions || options ? { ...config.callOptions, ...options } : undefined;
          const protoRes = await grpcMethod.call(grpcClient, protoReq, mergedOptions);
          return fromProto(protoRes);
        },
        catch: handleGrpcError,
      });

  const service: ClusterClientService = {
    getProtobufClient: () => grpcClient,

    createNamespace: makeGrpcCall(
      grpcClient.createNamespace,
      ClusterSchema.Namespace.Codec.CreateNamespaceRequest.toProto,
      ClusterSchema.Namespace.Codec.Namespace.fromProto,
    ),

    updateNamespace: makeGrpcCall(
      grpcClient.updateNamespace,
      ClusterSchema.Namespace.Codec.UpdateNamespaceRequest.toProto,
      ClusterSchema.Namespace.Codec.Namespace.fromProto,
    ),

    getNamespace: makeGrpcCall(
      grpcClient.getNamespace,
      ClusterSchema.Namespace.Codec.GetNamespaceRequest.toProto,
      ClusterSchema.Namespace.Codec.Namespace.fromProto,
    ),

    listNamespaces: makeGrpcCall(
      grpcClient.listNamespaces,
      ClusterSchema.Namespace.Codec.ListNamespacesRequest.toProto,
      ClusterSchema.Namespace.Codec.ListNamespacesResponse.fromProto,
    ),

    deleteNamespace: makeGrpcCall(
      grpcClient.deleteNamespace,
      ClusterSchema.Namespace.Codec.DeleteNamespaceRequest.toProto,
      () => undefined,
    ),

    createTable: makeGrpcCall(
      grpcClient.createTable,
      ClusterSchema.Table.Codec.CreateTableRequest.toProto,
      ClusterSchema.Table.Codec.Table.fromProto,
    ),

    getTable: makeGrpcCall(
      grpcClient.getTable,
      ClusterSchema.Table.Codec.GetTableRequest.toProto,
      ClusterSchema.Table.Codec.Table.fromProto,
    ),

    listTables: makeGrpcCall(
      grpcClient.listTables,
      ClusterSchema.Table.Codec.ListTablesRequest.toProto,
      ClusterSchema.Table.Codec.ListTablesResponse.fromProto,
    ),

    deleteTable: makeGrpcCall(
      grpcClient.deleteTable,
      ClusterSchema.Table.Codec.DeleteTableRequest.toProto,
      () => undefined,
    ),
  };

  return ClusterClient.of(service);
});

/**
 * Creates a ClusterClient Layer directly from config values.
 *
 * @param config - The cluster metadata configuration
 *
 * @example
 * ```typescript
 * import { ClusterClient } from "@useairfoil/wings";
 *
 * const LocalClusterClient = ClusterClient.layer({
 *   host: "localhost:7000"
 * });
 * ```
 */
export const layer = (config: ClusterClientOptions) => Layer.effect(ClusterClient)(make(config));

/**
 * Creates a ClusterClient Layer using Effect's Config module.
 *
 * Reads configuration from environment variables using the Config module.
 *
 * @param config - The cluster metadata configuration wrapped in Config
 *
 * @example
 * ```typescript
 * import { Config } from "effect";
 * import { ClusterClient } from "@useairfoil/wings";
 *
 * const LocalClusterClient = ClusterClient.layerConfig({
 *   host: Config.string("WINGS_URL").pipe(Config.withDefault("localhost:7000")),
 * });
 * ```
 */
export const layerConfig = (config: Config.Wrap<ClusterClientOptions>) =>
  Layer.effect(
    ClusterClient,
    Effect.gen(function* () {
      const params = yield* Config.unwrap(config);
      return yield* make(params);
    }),
  );

const handleGrpcError = (error: unknown) =>
  new ClusterClientError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
