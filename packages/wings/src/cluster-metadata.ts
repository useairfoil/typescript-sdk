import {
  type ClientOptions,
  createChannelFromConfig,
  type HostOrChannel,
} from "@airfoil/flight";
import { type Channel, createClient } from "nice-grpc";
import {
  type ClusterMetadataServiceClient,
  ClusterMetadataServiceDefinition,
} from "./proto/cluster_metadata";

export class ClusterMetadataClient {
  private channel: Channel;

  constructor(config: HostOrChannel) {
    this.channel = createChannelFromConfig(config);
  }

  create(
    options: ClientOptions<ClusterMetadataServiceDefinition> = {},
  ): ClusterMetadataServiceClient {
    return createClient(
      ClusterMetadataServiceDefinition,
      this.channel,
      options.defaultCallOptions,
    );
  }
}
