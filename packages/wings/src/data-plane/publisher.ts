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
import type { PartitionValue } from "../utils/partition-value";

import { WingsError } from "../errors";
import {
  IngestionOperation,
  IngestionRequestMetadata,
  IngestionResponseMetadata,
} from "../proto/wings/flight/ingestion";
import {
  ingestionSchemaUnsafe,
  type IngestionOperation as PushOperation,
} from "../utils/table-utils";

export interface PushOptions {
  readonly operation?: PushOperation;
  readonly batch: RecordBatch;
  readonly partitionValue?: PartitionValue;
}

export interface IngestionResult {
  readonly accepted: boolean;
  readonly message: string;
}

export interface Publisher {
  readonly push: (options: PushOptions) => Effect.Effect<IngestionResult, WingsError>;
}

/**
 * Creates a publisher for pushing data to a table.
 * The publisher manages a background fiber that processes responses.
 * The fiber lifecycle is tied to the provided scope (typically the WingsClient layer).
 */
export const makePublisher = Effect.fnUntraced(function* (
  client: ArrowFlightClientService,
  options: {
    readonly table: ClusterSchema.Table.Table;
    readonly partitionValue?: PartitionValue;
  },
): Effect.fn.Return<Publisher, WingsError, Scope.Scope> {
  const channel = new Channel<FlightData>();
  const { table, partitionValue: defaultPartitionValue } = options;

  // Extract bare table id (last path segment) for the FlightDescriptor
  const tableId = table.name.split("/").pop()!;

  const batchSchemas: Record<PushOperation, Schema> = {
    upsert: ingestionSchemaUnsafe(table, "upsert"),
    delete: ingestionSchemaUnsafe(table, "delete"),
  };

  const responseIterator = client.doPut(channel)[Symbol.asyncIterator]();

  const requestIdRef = yield* Ref.make(1n);
  const pendingRef = yield* Ref.make(
    new Map<bigint, Deferred.Deferred<IngestionResult, WingsError>>(),
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

      // Sentinel responses (requestId=0) are used to trigger server responses for real requests
      if (response.requestId === 0n) continue;

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
        if (!response.accepted) {
          yield* Deferred.fail(
            deferred,
            new WingsError({ message: response.message || "Ingestion rejected" }),
          );
        } else {
          yield* Deferred.succeed(deferred, {
            accepted: response.accepted,
            message: response.message,
          });
        }
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

  const descriptor = FlightDescriptor.create({
    type: FlightDescriptor_DescriptorType.PATH,
    path: [tableId] as Readonly<string[]>,
  });

  const operationProto = (operation: PushOperation) =>
    operation === "delete" ? IngestionOperation.DELETE : IngestionOperation.UPSERT;

  const publisher: Publisher = {
    push: (options) =>
      Effect.gen(function* () {
        const requestId = yield* Ref.getAndUpdate(requestIdRef, (id) => id + 1n);
        const operation = options.operation ?? "upsert";
        const batchSchema = batchSchemas[operation];
        // Create deferred for response
        const deferred = yield* Deferred.make<IngestionResult, WingsError>();

        yield* Ref.update(pendingRef, (pending) => {
          const updated = new Map(pending);
          updated.set(requestId, deferred);
          return updated;
        });

        const effectivePartitionValue = options.partitionValue ?? defaultPartitionValue;

        // Encode the schema message — IngestionRequestMetadata goes on the schema, not the batch
        const meta = IngestionRequestMetadata.create({
          requestId,
          operation: operationProto(operation),
          partitionValue: effectivePartitionValue,
        });

        const schemaMessage = FlightDataEncoder.encodeSchema(batchSchema, {
          flightDescriptor: descriptor,
          appMetadata: IngestionRequestMetadata.encode(meta).finish(),
        });

        const batchMessages = FlightDataEncoder.encodeBatch(options.batch);
        assert(batchMessages.length === 1, "Dictionary messages not supported");

        // Sentinel schema with requestId=0 triggers the server to flush the response for the
        // preceding real request without waiting for another real push or stream close.
        const sentinelMeta = IngestionRequestMetadata.encode(
          IngestionRequestMetadata.create({
            requestId: 0n,
            operation: operationProto(operation),
            partitionValue: effectivePartitionValue,
          }),
        ).finish();
        const sentinelMessage = FlightDataEncoder.encodeSchema(batchSchema, {
          flightDescriptor: descriptor,
          appMetadata: sentinelMeta,
        });

        // Send schema, batch, then sentinel — no yield points between these so they are
        // sent atomically with respect to concurrent pushes.
        channel.push(schemaMessage);
        for (const message of batchMessages) {
          channel.push(message);
        }
        // Sentinel triggers the server to emit the response for this request immediately
        channel.push(sentinelMessage);

        return yield* Deferred.await(deferred);
      }),
  };

  return publisher;
});
