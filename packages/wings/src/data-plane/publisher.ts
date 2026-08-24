import {
  type ArrowFlightClientService,
  type FlightData,
  FlightDataEncoder,
  FlightDescriptor,
  FlightDescriptor_DescriptorType,
} from "@useairfoil/flight";
import { type RecordBatch, Schema } from "apache-arrow";
import { Deferred, Effect, Fiber, Ref, type Scope } from "effect";
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
  ingestionSchema,
  type IngestionOperation as PushOperation,
  validatePartitionValue,
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

/** A closed publisher keeps its terminal error and has no pending requests. */
interface PublisherState {
  readonly error?: WingsError;
  readonly pending: Map<bigint, Deferred.Deferred<IngestionResult, WingsError>>;
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
  // A partition may be supplied on each push instead of at publisher creation.
  yield* validatePartitionValue(table, defaultPartitionValue, { allowMissing: true });

  // Extract bare table id (last path segment) for the FlightDescriptor
  const tableId = table.name.split("/").pop();
  if (!tableId) {
    return yield* Effect.fail(new WingsError({ message: "Wings table name is empty" }));
  }

  const batchSchemas: Record<PushOperation, Schema> = {
    upsert: yield* ingestionSchema(table, "upsert"),
    delete: yield* ingestionSchema(table, "delete"),
  };

  const responseIterator = yield* Effect.try({
    try: () => client.doPut(channel)[Symbol.asyncIterator](),
    catch: (cause) => new WingsError({ message: "Failed to open response stream", cause }),
  });

  const requestIdRef = yield* Ref.make(1n);
  const stateRef = yield* Ref.make<PublisherState>({ pending: new Map() });

  const ensureOpen = Ref.get(stateRef).pipe(
    Effect.flatMap((state) => (state.error === undefined ? Effect.void : Effect.fail(state.error))),
  );

  const closePublisher = (error: WingsError) =>
    // Detach every waiter atomically, then fail them outside the Ref update.
    Ref.modify(stateRef, (state) => {
      const terminalError = state.error ?? error;
      return [
        { error: terminalError, pending: [...state.pending.values()] },
        { error: terminalError, pending: new Map() },
      ] as const;
    }).pipe(
      Effect.flatMap(({ error, pending }) =>
        Effect.forEach(pending, (deferred) => Deferred.fail(deferred, error), { discard: true }),
      ),
    );

  const takePending = (requestId: bigint) =>
    Ref.modify(stateRef, (state) => {
      const deferred = state.pending.get(requestId);
      if (deferred === undefined) return [undefined, state] as const;
      const pending = new Map(state.pending);
      pending.delete(requestId);
      return [deferred, { ...state, pending }] as const;
    });

  const removePending = (requestId: bigint) =>
    Ref.update(stateRef, (state) => {
      if (!state.pending.has(requestId)) return state;
      const pending = new Map(state.pending);
      pending.delete(requestId);
      return { ...state, pending };
    });

  const registerPending = (
    requestId: bigint,
    deferred: Deferred.Deferred<IngestionResult, WingsError>,
  ) =>
    // Registration and the closed-state check must be one atomic transition.
    Ref.modify(stateRef, (state) => {
      if (state.error !== undefined) return [state.error, state] as const;
      const pending = new Map(state.pending);
      pending.set(requestId, deferred);
      return [undefined, { pending }] as const;
    }).pipe(Effect.flatMap((error) => (error === undefined ? Effect.void : Effect.fail(error))));

  // Background fiber that processes responses
  const responseLoop = Effect.gen(function* () {
    while (true) {
      const result = yield* Effect.tryPromise({
        try: () => responseIterator.next(),
        catch: (cause) => new WingsError({ message: "Response stream error", cause }),
      });

      if (result.done) return;

      const response = yield* Effect.try({
        try: () => IngestionResponseMetadata.decode(result.value.appMetadata),
        catch: (cause) => new WingsError({ message: "Invalid ingestion response", cause }),
      });

      // Sentinel responses (requestId=0) are used to trigger server responses for real requests
      if (response.requestId === 0n) continue;

      const deferred = yield* takePending(response.requestId);

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

  // Every push shares this stream, so its exit closes the whole publisher.
  const processResponses = responseLoop.pipe(
    Effect.matchCauseEffect({
      onFailure: (cause) =>
        closePublisher(new WingsError({ message: "Response stream failed", cause })),
      onSuccess: () => closePublisher(new WingsError({ message: "Response stream closed" })),
    }),
  );

  const responseFiber = yield* Effect.forkScoped(processResponses);

  yield* Effect.addFinalizer(() =>
    Effect.gen(function* () {
      yield* closePublisher(new WingsError({ message: "Publisher closed" }));
      yield* Fiber.interrupt(responseFiber);
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
        yield* ensureOpen;
        const requestId = yield* Ref.getAndUpdate(requestIdRef, (id) => id + 1n);
        const operation = options.operation ?? "upsert";
        const batchSchema = batchSchemas[operation];
        const effectivePartitionValue = options.partitionValue ?? defaultPartitionValue;
        yield* validatePartitionValue(table, effectivePartitionValue);

        // Encode before registration so local failures cannot leave an orphaned waiter.
        const encoded = yield* Effect.try({
          try: () => {
            // Request metadata belongs on the schema message, not the batch.
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
            if (batchMessages.length !== 1) {
              throw new Error("Dictionary messages are not supported");
            }

            // The sentinel makes the server flush this request without waiting for stream close.
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
            return { batchMessages, schemaMessage, sentinelMessage };
          },
          catch: (cause) =>
            new WingsError({ message: "Failed to encode ingestion request", cause }),
        });

        const deferred = yield* Deferred.make<IngestionResult, WingsError>();
        yield* registerPending(requestId, deferred);

        return yield* Effect.try({
          try: () => {
            // No yield points here: concurrent pushes cannot interleave their messages.
            channel.push(encoded.schemaMessage);
            for (const message of encoded.batchMessages) channel.push(message);
            channel.push(encoded.sentinelMessage);
          },
          catch: (cause) => new WingsError({ message: "Failed to send ingestion request", cause }),
        }).pipe(
          Effect.andThen(Deferred.await(deferred)),
          // Also runs when the caller is interrupted while waiting for Wings.
          Effect.ensuring(removePending(requestId)),
        );
      }),
  };

  return publisher;
});
