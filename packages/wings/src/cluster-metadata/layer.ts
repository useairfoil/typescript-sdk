import { createChannelFromConfig } from "@airfoil/flight";
import { Config, Effect, Layer } from "effect";
import { type CallOptions, createClient } from "nice-grpc";
import { ClusterMetadataError } from "../errors";
import {
  type ClusterMetadataServiceClient,
  ClusterMetadataServiceDefinition,
} from "../proto/cluster_metadata";

import * as Schemas from "../schema";

import type { ClusterMetadataParams } from "./config";
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
              config.callOptions || options
                ? { ...(config.callOptions ?? {}), ...(options ?? {}) }
                : undefined;
            const protoRes = await grpcMethod.call(
              grpcClient,
              protoReq,
              mergedOptions,
            );
            return fromProto(protoRes);
          },
          catch: handleGrpcError,
        });

    const service: ClusterMetadataService = {
      getProtobufClient: () => grpcClient,

      createTenant: makeGrpcCall(
        grpcClient.createTenant,
        Schemas.Tenant.Codec.CreateTenantRequest.toProto,
        Schemas.Tenant.Codec.Tenant.fromProto,
      ),

      getTenant: makeGrpcCall(
        grpcClient.getTenant,
        Schemas.Tenant.Codec.GetTenantRequest.toProto,
        Schemas.Tenant.Codec.Tenant.fromProto,
      ),

      listTenants: makeGrpcCall(
        grpcClient.listTenants,
        Schemas.Tenant.Codec.ListTenantsRequest.toProto,
        Schemas.Tenant.Codec.ListTenantsResponse.fromProto,
      ),

      deleteTenant: makeGrpcCall(
        grpcClient.deleteTenant,
        Schemas.Tenant.Codec.DeleteTenantRequest.toProto,
        () => undefined,
      ),

      createNamespace: makeGrpcCall(
        grpcClient.createNamespace,
        Schemas.Namespace.Codec.CreateNamespaceRequest.toProto,
        Schemas.Namespace.Codec.Namespace.fromProto,
      ),

      getNamespace: makeGrpcCall(
        grpcClient.getNamespace,
        Schemas.Namespace.Codec.GetNamespaceRequest.toProto,
        Schemas.Namespace.Codec.Namespace.fromProto,
      ),

      listNamespaces: makeGrpcCall(
        grpcClient.listNamespaces,
        Schemas.Namespace.Codec.ListNamespacesRequest.toProto,
        Schemas.Namespace.Codec.ListNamespacesResponse.fromProto,
      ),

      deleteNamespace: makeGrpcCall(
        grpcClient.deleteNamespace,
        Schemas.Namespace.Codec.DeleteNamespaceRequest.toProto,
        () => undefined,
      ),

      createTopic: makeGrpcCall(
        grpcClient.createTopic,
        Schemas.Topic.Codec.CreateTopicRequest.toProto,
        Schemas.Topic.Codec.Topic.fromProto,
      ),

      getTopic: makeGrpcCall(
        grpcClient.getTopic,
        Schemas.Topic.Codec.GetTopicRequest.toProto,
        Schemas.Topic.Codec.Topic.fromProto,
      ),

      listTopics: makeGrpcCall(
        grpcClient.listTopics,
        Schemas.Topic.Codec.ListTopicsRequest.toProto,
        Schemas.Topic.Codec.ListTopicsResponse.fromProto,
      ),

      deleteTopic: makeGrpcCall(
        grpcClient.deleteTopic,
        Schemas.Topic.Codec.DeleteTopicRequest.toProto,
        () => undefined,
      ),

      createObjectStore: makeGrpcCall(
        grpcClient.createObjectStore,
        Schemas.ObjectStore.Codec.CreateObjectStoreRequest.toProto,
        Schemas.ObjectStore.Codec.ObjectStore.fromProto,
      ),

      getObjectStore: makeGrpcCall(
        grpcClient.getObjectStore,
        Schemas.ObjectStore.Codec.GetObjectStoreRequest.toProto,
        Schemas.ObjectStore.Codec.ObjectStore.fromProto,
      ),

      listObjectStores: makeGrpcCall(
        grpcClient.listObjectStores,
        Schemas.ObjectStore.Codec.ListObjectStoresRequest.toProto,
        Schemas.ObjectStore.Codec.ListObjectStoresResponse.fromProto,
      ),

      deleteObjectStore: makeGrpcCall(
        grpcClient.deleteObjectStore,
        Schemas.ObjectStore.Codec.DeleteObjectStoreRequest.toProto,
        () => undefined,
      ),

      createDataLake: makeGrpcCall(
        grpcClient.createDataLake,
        Schemas.DataLake.Codec.CreateDataLakeRequest.toProto,
        Schemas.DataLake.Codec.DataLake.fromProto,
      ),

      getDataLake: makeGrpcCall(
        grpcClient.getDataLake,
        Schemas.DataLake.Codec.GetDataLakeRequest.toProto,
        Schemas.DataLake.Codec.DataLake.fromProto,
      ),

      listDataLakes: makeGrpcCall(
        grpcClient.listDataLakes,
        Schemas.DataLake.Codec.ListDataLakesRequest.toProto,
        Schemas.DataLake.Codec.ListDataLakesResponse.fromProto,
      ),

      deleteDataLake: makeGrpcCall(
        grpcClient.deleteDataLake,
        Schemas.DataLake.Codec.DeleteDataLakeRequest.toProto,
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
 * import { ClusterMetadata } from "@airfoil/wings";
 *
 * const LocalClusterMetadata = ClusterMetadata.layer({
 *   host: "localhost:7000"
 * });
 * ```
 */
export const layer = (config: ClusterMetadataParams) =>
  Layer.effect(ClusterMetadata, make(config));

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
 * import { ClusterMetadata } from "@airfoil/wings";
 *
 * const LocalClusterMetadata = ClusterMetadata.layerConfig({
 *   host: Config.string("WINGS_URL").pipe(Config.withDefault("localhost:7000")),
 * });
 * ```
 */
export const layerConfig = (
  config: Config.Config.Wrap<ClusterMetadataParams>,
) =>
  Layer.effect(
    ClusterMetadata,
    Config.unwrap(config).pipe(Effect.flatMap(make)),
  );

const handleGrpcError = (error: unknown) =>
  new ClusterMetadataError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
