import type { ArrowFlightClient } from "@airfoil/flight";
import type { Schema } from "apache-arrow";
import type { PartitionValue } from "./partition-value";
import type { Topic } from "./proto/cluster_metadata";
import { FetchTicket } from "./proto/utils";
import { createAny, createTicket } from "./proto-utils";
import { topicSchema } from "./topic";

export class FetchClient {
  private schema: Schema;
  private offset: bigint;

  constructor(
    private topic: Topic,
    private client: ArrowFlightClient,
    private partitionValue?: PartitionValue,
  ) {
    this.schema = topicSchema(this.topic);
    this.offset = 0n;
  }

  public setOffset(offset: bigint) {
    this.offset = offset;
  }

  public async next() {
    console.log(this.partitionValue);
    const ticket = createAny(FetchTicket, {
      topicName: this.topic.name,
      // @ts-expect-error
      partitionValue: this.partitionValue,
      offset: this.offset,
      minBatchSize: 1,
      maxBatchSize: 100,
    });

    const response = this.client.doGet(createTicket(ticket), {
      schema: this.schema,
    });

    for await (const chunk of response) {
      console.log(chunk);
    }
  }
}
