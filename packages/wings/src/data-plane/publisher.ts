import {
  type ArrowFlightClientService,
  type FlightData,
  FlightDataEncoder,
  FlightDescriptor,
  FlightDescriptor_DescriptorType,
} from "@useairfoil/flight";
import { type RecordBatch, Schema } from "apache-arrow";
import { Deferred, Effect, Fiber, Ref, type Scope } from "effect";
import assert from "node:assert";
import { Channel } from "queueable";

import type * as ClusterSchema from "../cluster";
import type { PartitionValue } from "../partition-value";
import type { CommittedBatch } from "../proto/wings/v1/log_metadata";

import { Codec as ArrowTypeCodec } from "../cluster/arrow-type";
import { WingsError } from "../errors";
import { arrowSchemaFromProto } from "../lib/arrow";
import { IngestionRequestMetadata, IngestionResponseMetadata } from "../proto/utils";

export interface PushOptions {
  readonly batch: RecordBatch;
  readonly partitionValue?: PartitionValue;
}

export interface Publisher {
  readonly push: (options: PushOptions) => Effect.Effect<CommittedBatch, WingsError>;
}

/**
 * Creates a publisher for pushing data to a topic.
 * The publisher manages a background fiber that processes responses.
 * The fiber lifecycle is tied to the provided scope (typically the WingsClient layer).
 */
export const makePublisher = (
  client: ArrowFlightClientService,
  options: {
    readonly topic: ClusterSchema.Topic.Topic;
    readonly partitionValue?: PartitionValue;
  },
): Effect.Effect<Publisher, WingsError, Scope.Scope> =>
  Effect.fnUntraced(function* (): Effect.fn.Return<Publisher, WingsError, Scope.Scope> {
    const channel = new Channel<FlightData>();
    const { topic, partitionValue: defaultPartitionValue } = options;

    // Find partition key index using field id directly from our ArrowSchema
    const partitionKeyIndex =
      topic.partitionKey !== undefined
        ? topic.schema.fields.findIndex((field) => field.id === topic.partitionKey)
        : undefined;

    if (topic.partitionKey !== undefined && partitionKeyIndex === -1) {
      return yield* Effect.fail(
        new WingsError({
          message: `Partition key field id ${topic.partitionKey.toString()} not found in schema`,
        }),
      );
    }

    const fullSchema = arrowSchemaFromProto(ArrowTypeCodec.ArrowSchema.toProto(topic.schema));

    const batchSchema: Schema =
      partitionKeyIndex !== undefined && partitionKeyIndex >= 0
        ? new Schema(
            fullSchema.fields.filter((_, idx) => idx !== partitionKeyIndex),
            fullSchema.metadata,
          )
        : fullSchema;

    // Send initial schema message
    const path: Readonly<string[]> = [topic.name];
    channel.push(
      FlightDataEncoder.encodeSchema(batchSchema, {
        flightDescriptor: FlightDescriptor.create({
          type: FlightDescriptor_DescriptorType.PATH,
          path,
        }),
      }),
    );

    const responseIterator = client.doPut(channel)[Symbol.asyncIterator]();

    const initialResult = yield* Effect.tryPromise({
      try: () => responseIterator.next(),
      catch: (error) =>
        new WingsError({
          message: "Failed to start push stream",
          cause: error,
        }),
    });

    if (initialResult.done) {
      return yield* Effect.fail(new WingsError({ message: "Failed to create publisher" }));
    }

    const meta = IngestionResponseMetadata.decode(initialResult.value.appMetadata);
    if (meta.requestId !== 0n) {
      return yield* Effect.fail(new WingsError({ message: "Invalid initial response id" }));
    }

    const requestIdRef = yield* Ref.make(1n);
    const pendingRef = yield* Ref.make(
      new Map<bigint, Deferred.Deferred<CommittedBatch, WingsError>>(),
    );

    // Background fiber that processes responses
    const processResponses = Effect.gen(function* () {
      while (true) {
        const result = yield* Effect.tryPromise({
          try: () => responseIterator.next(),
          catch: (error) =>
            new WingsError({
              message: "Response stream error",
              cause: error,
            }),
        });

        if (result.done) {
          const pending = yield* Ref.get(pendingRef);
          for (const [requestId, deferred] of pending.entries()) {
            yield* Deferred.fail(
              deferred,
              new WingsError({
                message: `Stream closed waiting for response: ${requestId}`,
              }),
            );
          }
          yield* Ref.set(pendingRef, new Map());
          break;
        }

        const response = IngestionResponseMetadata.decode(result.value.appMetadata);
        if (response.result === undefined) {
          // Invalid response - fail all pending
          const pending = yield* Ref.get(pendingRef);
          const error = new WingsError({ message: "Invalid push response" });
          for (const deferred of pending.values()) {
            yield* Deferred.fail(deferred, error);
          }
          yield* Ref.set(pendingRef, new Map());
          return yield* Effect.fail(error);
        }

        // Do match + remove in one step, so concurrent push updates don't get overwritten.
        const deferred = yield* Ref.modify(pendingRef, (pending) => {
          const matched = pending.get(response.requestId);
          if (matched === undefined) {
            return [undefined, pending] as const;
          }

          const updated = new Map(pending);
          updated.delete(response.requestId);
          return [matched, updated] as const;
        });

        if (deferred) {
          yield* Deferred.succeed(deferred, response.result);
        }
      }
    });

    const responseFiber = yield* Effect.forkScoped(processResponses);

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* Fiber.interrupt(responseFiber);

        // Fail all pending requests
        const pending = yield* Ref.get(pendingRef);
        const closeError = new WingsError({ message: "Publisher closed" });
        for (const deferred of pending.values()) {
          yield* Deferred.fail(deferred, closeError);
        }

        channel.close();
      }).pipe(Effect.catchCause(() => Effect.void)),
    );

    const publisher: Publisher = {
      push: (options) =>
        Effect.gen(function* () {
          const requestId = yield* Ref.getAndUpdate(requestIdRef, (id) => id + 1n);
          // Create deferred for response
          const deferred = yield* Deferred.make<CommittedBatch, WingsError>();

          yield* Ref.update(pendingRef, (pending) => {
            const updated = new Map(pending);
            updated.set(requestId, deferred);
            return updated;
          });

          const effectivePartitionValue = options.partitionValue ?? defaultPartitionValue;

          // Encode and send batch
          const messages = FlightDataEncoder.encodeBatch(options.batch, {
            appMetadata({ length }) {
              assert(length === 1, "Unexpected metadata length");
              const meta = IngestionRequestMetadata.create({
                requestId,
                partitionValue: effectivePartitionValue,
              });
              return IngestionRequestMetadata.encode(meta).finish();
            },
          });

          assert(messages.length === 1, "Dictionary messages not supported");

          for (const message of messages) {
            channel.push(message);
          }

          return yield* Deferred.await(deferred);
        }),
    };

    return publisher;
  })();
