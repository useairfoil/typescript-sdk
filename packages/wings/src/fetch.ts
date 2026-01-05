import type { ArrowFlightClient } from "@airfoil/flight";
import type { RecordBatch, Schema } from "apache-arrow";
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
    const ticket = createAny(FetchTicket, {
      topicName: this.topic.name,
      // @ts-expect-error just the type incompatibility between protobuf-generated types
      partitionValue: this.partitionValue,
      offset: this.offset,
      minBatchSize: 1,
      maxBatchSize: 100,
    });

    const response = this.client.doGet(createTicket(ticket), {
      schema: this.schema,
    });

    const batches: RecordBatch[] = [];

    for await (const batch of response) {
      batches.push(batch);
    }

    // update offset
    if (batches.length > 0) {
      const lastBatch = batches[batches.length - 1];
      const offsetColumn = lastBatch.getChild("__offset__");
      if (offsetColumn && offsetColumn.length > 0) {
        const lastOffset = offsetColumn.get(offsetColumn.length - 1);
        this.offset = lastOffset + 1n;
      }
    }

    return batches;
  }
}
