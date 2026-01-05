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
  private pending: Map<
    number,
    {
      resolve: (result: CommittedBatch) => void;
      reject: (error: Error) => void;
    }
  >;
  private responseLoopStarted: boolean;
  private responseLoopError: Error | null;

  constructor(
    private channel: Channel<FlightData>,
    public response: AsyncIterator<PutResult>,
  ) {
    this.requestId = 1n;
    this.pending = new Map();
    this.responseLoopStarted = false;
    this.responseLoopError = null;
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

    const client = new PushClient(channel, response);
    client.startResponseLoop();
    return client;
  }

  /**
   * starts a single loop that always reads responses from the gRPC stream
   * and dispatches them to the respective waiting promises.
   * This prevents the race condition that occurs when multiple concurrent
   * waitForResponse calls try to read from the same iterator.
   */
  private startResponseLoop() {
    if (this.responseLoopStarted) {
      return;
    }
    this.responseLoopStarted = true;

    (async () => {
      try {
        while (true) {
          const putResult = await this.response.next();

          if (putResult.done) {
            for (const [requestId, { reject }] of this.pending.entries()) {
              reject(
                new Error(
                  `Stream closed unexpectedly waiting for response: ${requestId}`,
                ),
              );
            }
            this.pending.clear();
            break;
          }

          const response = IngestionResponseMetadata.decode(
            putResult.value.appMetadata,
          );

          if (response.result === undefined) {
            const error = new Error("Invalid push response");
            for (const { reject } of this.pending.values()) {
              reject(error);
            }
            this.pending.clear();
            this.responseLoopError = error;
            break;
          }

          const requestIdNum = Number(response.requestId);
          const pending = this.pending.get(requestIdNum);
          if (pending) {
            pending.resolve(response.result);
            this.pending.delete(requestIdNum);
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        for (const { reject } of this.pending.values()) {
          reject(err);
        }
        this.pending.clear();
        this.responseLoopError = err;
      }
    })();
  }

  private async waitForResponse(requestId: bigint): Promise<CommittedBatch> {
    if (this.responseLoopError) {
      throw this.responseLoopError;
    }

    return new Promise<CommittedBatch>((resolve, reject) => {
      this.pending.set(Number(requestId), { resolve, reject });
    });
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

  /**
   * Close the push client and clean up the gRPC stream.
   * This should be called when you're done pushing data to properly
   * close the connection.
   */
  close() {
    const error = new Error("PushClient closed");
    for (const { reject } of this.pending.values()) {
      reject(error);
    }
    this.pending.clear();

    this.channel.close();
  }
}
