import assert from "node:assert";
import {
  type ArrowFlightClient,
  type FlightData,
  FlightDataEncoder,
  FlightDescriptor,
  FlightDescriptor_DescriptorType,
  type PutResult,
} from "@airfoil/flight";
import { type RecordBatch, Schema } from "apache-arrow";
import { Channel } from "queueable";
import type { PartitionValue } from "./partition-value";
import type { Topic } from "./proto/cluster_metadata";
import type { CommittedBatch } from "./proto/log_metadata";
import {
  IngestionRequestMetadata,
  IngestionResponseMetadata,
} from "./proto/utils";
import { topicSchema } from "./topic";

export class PushClient {
  private requestId: bigint;
  private completed: Record<number, CommittedBatch>;

  constructor(
    private channel: Channel<FlightData>,
    public response: AsyncIterator<PutResult>,
  ) {
    this.requestId = 1n;
    this.completed = {};
  }

  static async create(topic: Topic, flightClient: ArrowFlightClient) {
    const channel = new Channel<FlightData>();

    // Send schema message. If the topic has a partition key, we need to exclude
    // that field from the schema since partition values are sent separately
    // in the request metadata, not as columns in the RecordBatch.
    const fullSchema = topicSchema(topic);
    const batchSchema =
      topic.partitionKey !== undefined
        ? new Schema(
            fullSchema.fields.filter((_, idx) => idx !== topic.partitionKey),
            fullSchema.metadata,
          )
        : fullSchema;

    const path: Readonly<string[]> = [topic.name];
    channel.push(
      FlightDataEncoder.encodeSchema(batchSchema, {
        flightDescriptor: FlightDescriptor.create({
          type: FlightDescriptor_DescriptorType.PATH,
          path,
        }),
      }),
    );

    const response = flightClient.doPut(channel)[Symbol.asyncIterator]();

    const putResult = await response.next();
    if (putResult.done) {
      throw new Error("Failed to create push client");
    }

    const meta = IngestionResponseMetadata.decode(putResult.value.appMetadata);

    if (meta.requestId !== 0n) {
      throw new Error(`Failed to create push client: invalid response id`);
    }

    return new PushClient(channel, response);
  }

  private async waitForResponse(requestId: bigint): Promise<CommittedBatch> {
    if (this.completed[Number(requestId)]) {
      const result = this.completed[Number(requestId)];
      delete this.completed[Number(requestId)];
      return result;
    }

    while (true) {
      const putResult = await this.response.next();

      if (putResult.done) {
        throw new Error(
          `Stream closed unexpectedly waiting for response: ${requestId}`,
        );
      }

      const response = IngestionResponseMetadata.decode(
        putResult.value.appMetadata,
      );

      if (response.result === undefined) {
        throw new Error(`invalid push response`);
      }

      if (response.requestId === requestId) {
        return response.result;
      }

      this.completed[Number(response.requestId)] = response.result;
    }
  }

  push({
    batch,
    partitionValue,
  }: {
    batch: RecordBatch;
    partitionValue?: PartitionValue;
  }) {
    const requestId = this.requestId++;

    const messages = FlightDataEncoder.encodeBatch(batch, {
      appMetadata({ length }) {
        assert(length === 1, "Unexpected metadata length");
        const meta = IngestionRequestMetadata.create({
          requestId,
          partitionValue,
        });
        return IngestionRequestMetadata.encode(meta).finish();
      },
    });

    assert(messages.length === 1, "Dictionary messages not supported yet");

    for (const message of messages) {
      this.channel.push(message);
    }

    return this.waitForResponse(requestId);
  }
}
