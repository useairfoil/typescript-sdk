import { createChannelFromConfig } from "@useairfoil/flight";
import { Config, Effect, Layer } from "effect";
import { type CallOptions, createClient } from "nice-grpc";

import type { ClusterMetadataParams } from "./config";

import * as ClusterSchema from "../cluster";
import { ClusterMetadataError } from "../errors";
import {
  type ClusterMetadataServiceClient,
  ClusterMetadataServiceDefinition,
} from "../proto/wings/v1/cluster_metadata";
import { ClusterMetadata, type ClusterMetadataService } from "./service";

/**
 * Creates the ClusterMetadata service implementation from config.
 *
 * @example
 * ```typescript
 * const clusterMetadata = yield* WingsClusterMetadata.make({
 *   host: "localhost:7000"
 * });
 * ```
 */
export const make = (config: ClusterMetadataParams) =>
  Effect.gen(function* () {
    const channel = createChannelFromConfig({ host: config.host });
    const grpcClient: ClusterMetadataServiceClient = createClient(
      ClusterMetadataServiceDefinition,
      channel,
    );

    yield* Effect.addFinalizer(() =>
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

    const service: ClusterMetadataService = {
      getProtobufClient: () => grpcClient,

      createTenant: makeGrpcCall(
        grpcClient.createTenant,
        ClusterSchema.Tenant.Codec.CreateTenantRequest.toProto,
        ClusterSchema.Tenant.Codec.Tenant.fromProto,
      ),

      getTenant: makeGrpcCall(
        grpcClient.getTenant,
        ClusterSchema.Tenant.Codec.GetTenantRequest.toProto,
        ClusterSchema.Tenant.Codec.Tenant.fromProto,
      ),

      listTenants: makeGrpcCall(
        grpcClient.listTenants,
        ClusterSchema.Tenant.Codec.ListTenantsRequest.toProto,
        ClusterSchema.Tenant.Codec.ListTenantsResponse.fromProto,
      ),

      deleteTenant: makeGrpcCall(
        grpcClient.deleteTenant,
        ClusterSchema.Tenant.Codec.DeleteTenantRequest.toProto,
        () => undefined,
      ),

      createNamespace: makeGrpcCall(
        grpcClient.createNamespace,
        ClusterSchema.Namespace.Codec.CreateNamespaceRequest.toProto,
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

      createTopic: makeGrpcCall(
        grpcClient.createTopic,
        ClusterSchema.Topic.Codec.CreateTopicRequest.toProto,
        ClusterSchema.Topic.Codec.Topic.fromProto,
      ),

      getTopic: makeGrpcCall(
        grpcClient.getTopic,
        ClusterSchema.Topic.Codec.GetTopicRequest.toProto,
        ClusterSchema.Topic.Codec.Topic.fromProto,
      ),

      listTopics: makeGrpcCall(
        grpcClient.listTopics,
        ClusterSchema.Topic.Codec.ListTopicsRequest.toProto,
        ClusterSchema.Topic.Codec.ListTopicsResponse.fromProto,
      ),

      deleteTopic: makeGrpcCall(
        grpcClient.deleteTopic,
        ClusterSchema.Topic.Codec.DeleteTopicRequest.toProto,
        () => undefined,
      ),

      createObjectStore: makeGrpcCall(
        grpcClient.createObjectStore,
        ClusterSchema.ObjectStore.Codec.CreateObjectStoreRequest.toProto,
        ClusterSchema.ObjectStore.Codec.ObjectStore.fromProto,
      ),

      getObjectStore: makeGrpcCall(
        grpcClient.getObjectStore,
        ClusterSchema.ObjectStore.Codec.GetObjectStoreRequest.toProto,
        ClusterSchema.ObjectStore.Codec.ObjectStore.fromProto,
      ),

      listObjectStores: makeGrpcCall(
        grpcClient.listObjectStores,
        ClusterSchema.ObjectStore.Codec.ListObjectStoresRequest.toProto,
        ClusterSchema.ObjectStore.Codec.ListObjectStoresResponse.fromProto,
      ),

      deleteObjectStore: makeGrpcCall(
        grpcClient.deleteObjectStore,
        ClusterSchema.ObjectStore.Codec.DeleteObjectStoreRequest.toProto,
        () => undefined,
      ),

      createDataLake: makeGrpcCall(
        grpcClient.createDataLake,
        ClusterSchema.DataLake.Codec.CreateDataLakeRequest.toProto,
        ClusterSchema.DataLake.Codec.DataLake.fromProto,
      ),

      getDataLake: makeGrpcCall(
        grpcClient.getDataLake,
        ClusterSchema.DataLake.Codec.GetDataLakeRequest.toProto,
        ClusterSchema.DataLake.Codec.DataLake.fromProto,
      ),

      listDataLakes: makeGrpcCall(
        grpcClient.listDataLakes,
        ClusterSchema.DataLake.Codec.ListDataLakesRequest.toProto,
        ClusterSchema.DataLake.Codec.ListDataLakesResponse.fromProto,
      ),

      deleteDataLake: makeGrpcCall(
        grpcClient.deleteDataLake,
        ClusterSchema.DataLake.Codec.DeleteDataLakeRequest.toProto,
        () => undefined,
      ),
    };

    return ClusterMetadata.of(service);
  });

/**
 * Creates a ClusterMetadata Layer directly from config values.
 *
 * @param config - The cluster metadata configuration
 *
 * @example
 * ```typescript
 * import { ClusterMetadata } from "@useairfoil/wings";
 *
 * const LocalClusterMetadata = ClusterMetadata.layer({
 *   host: "localhost:7000"
 * });
 * ```
 */
export const layer = (config: ClusterMetadataParams) => Layer.effect(ClusterMetadata)(make(config));

/**
 * Creates a ClusterMetadata Layer using Effect's Config module.
 *
 * Reads configuration from environment variables using the Config module.
 *
 * @param config - The cluster metadata configuration wrapped in Config
 *
 * @example
 * ```typescript
 * import { Config } from "effect";
 * import { ClusterMetadata } from "@useairfoil/wings";
 *
 * const LocalClusterMetadata = ClusterMetadata.layerConfig({
 *   host: Config.string("WINGS_URL").pipe(Config.withDefault("localhost:7000")),
 * });
 * ```
 */
export const layerConfig = (config: Config.Wrap<ClusterMetadataParams>) =>
  Layer.effect(
    ClusterMetadata,
    Effect.gen(function* () {
      const params = yield* Config.unwrap(config);
      return yield* make(params);
    }),
  );

const handleGrpcError = (error: unknown) =>
  new ClusterMetadataError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
