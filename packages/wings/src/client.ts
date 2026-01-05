import {
  ArrowFlightClient,
  type ClientOptions,
  createChannelFromConfig,
  type HostOrChannel,
} from "@airfoil/flight";
import { type Channel, Metadata } from "nice-grpc";
import { ClusterMetadataClient } from "./cluster-metadata";
import { FetchClient } from "./fetch";
import type { PartitionValue } from "./partition-value";
import type { ClusterMetadataServiceDefinition } from "./proto/cluster_metadata";
import { PushClient } from "./push";

export class WingsClient {
  private channel: Channel;
  private namespace: string;

  constructor({ namespace, ...config }: HostOrChannel & { namespace: string }) {
    this.channel = createChannelFromConfig(config);
    this.namespace = namespace;
  }

  clusterMetadataClient(
    options: ClientOptions<ClusterMetadataServiceDefinition> = {},
  ): ClusterMetadataClient {
    return new ClusterMetadataClient({ channel: this.channel }, options);
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
    const topic = await clusterMeta.rawClient().getTopic({
      name: topicName,
    });

    return new FetchClient(topic, this.flightClient(), partitionValue);
  }

  async pushClient(topicName: string) {
    const clusterMeta = this.clusterMetadataClient();
    const topic = await clusterMeta.rawClient().getTopic({
      name: topicName,
    });

    return PushClient.create(topic, this.flightClient());
  }
}
