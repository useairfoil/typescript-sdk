import {
  type ArrowFlightClient,
  type CreateArrowFlightClientOptions,
  createArrowFlightClient,
  Metadata,
} from "@airfoil/flight";
import { createFetchClient } from "./fetch";
import { createPushClient } from "./push";
import { TopicClient } from "./topic-client";

export interface WingsClientOptions {
  connectionString: string;
  clientOptions?: CreateArrowFlightClientOptions;
  namespace: string;
}

export class WingsClient {
  private readonly flightClient: ArrowFlightClient;
  private readonly metadata: Metadata;

  constructor(private readonly options: WingsClientOptions) {
    this.flightClient = createArrowFlightClient(
      options.connectionString,
      options.clientOptions,
    );
    this.metadata = new Metadata();
    this.metadata.set("x-wings-namespace", options.namespace);
  }

  async fetch(topicName: string) {
    const topic = await TopicClient.getTopic(
      topicName,
      this.options.connectionString,
    );

    return await createFetchClient({
      flightClient: this.flightClient,
      namespace: this.options.namespace,
      topic,
      metadata: this.metadata,
    });
  }

  async push(topicName: string) {
    const topic = await TopicClient.getTopic(
      topicName,
      this.options.connectionString,
    );

    return await createPushClient({
      flightClient: this.flightClient,
      namespace: this.options.namespace,
      topic,
      metadata: this.metadata,
    });
  }
}
