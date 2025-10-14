import {
  ArrowFlightClient,
  type ClientOptions,
  createChannelFromConfig,
  type HostOrChannel,
} from "@airfoil/flight";
import { type Channel, createClient, Metadata } from "nice-grpc";
import { FetchClient } from "./fetch";
import type { PartitionValue } from "./partition-value";
import {
  type ClusterMetadataServiceClient,
  ClusterMetadataServiceDefinition,
} from "./proto/cluster_metadata";
import { PushClient } from "./push";

export class WingsClient {
  private channel: Channel;
  private namespace: string;

  constructor({ namespace, ...config }: HostOrChannel & { namespace: string }) {
    this.channel = createChannelFromConfig(config);
    this.namespace = namespace;
  }

  clusterMetadataClient(
    _options: ClientOptions<ClusterMetadataServiceDefinition> = {},
  ): ClusterMetadataServiceClient {
    // TODO: merge options with default call options
    return createClient(ClusterMetadataServiceDefinition, this.channel, {});
  }

  flightClient() {
    return new ArrowFlightClient(
      { channel: this.channel },
      {
        defaultCallOptions: {
          "*": {
            metadata: Metadata({
              "x-wings-namespace": this.namespace,
            }),
          },
        },
      },
    );
  }

  async fetchClient(topicName: string, partitionValue?: PartitionValue) {
    const clusterMeta = this.clusterMetadataClient();
    const topic = await clusterMeta.getTopic({
      name: topicName,
    });

    return new FetchClient(topic, this.flightClient(), partitionValue);
  }

  async pushClient(topicName: string) {
    const clusterMeta = this.clusterMetadataClient();
    const topic = await clusterMeta.getTopic({
      name: topicName,
    });

    return PushClient.create(topic, this.flightClient());
  }
}
