import type { ArrowFlightClient } from "@airfoil/flight";
import type { RecordBatch } from "apache-arrow";
import { Effect, Stream } from "effect";
import { WingsError } from "../errors";
import { FetchTicket } from "../proto/utils";
import { createAny, createTicket } from "../proto-utils";
import type { FetchOptions } from "./service";

/**
 * Streams data from a topic. The stream polls continuously until interrupted.
 * Empty results don't stop the stream - it keeps polling for new data.
 *
 * @example
 * // Take 10 batches then stop
 * stream.pipe(Stream.take(10), Stream.runCollect)
 *
 * // Run with timeout
 * stream.pipe(Stream.runCollect, Effect.timeout("5 seconds"))
 *
 * @example
 * // Run forever (until scope closes or effect is interrupted)
 * stream.pipe(
 *   Stream.tap((batch) => Effect.log(`Got ${batch.numRows} rows`)),
 *   Stream.runDrain,
 * )
 *
 * @example
 * // Run in background fiber
 * const fiber = yield* stream.pipe(
 *   Stream.tap((batch) => processBatch(batch)),
 *   Stream.runDrain,
 *   Effect.forkScoped,
 * );
 * // ... do other work ...
 * yield* Fiber.interrupt(fiber);
 *
 * @example
 * // Run until a condition is met (e.g., 1000 rows processed)
 * stream.pipe(
 *   Stream.mapAccum(0, (acc, batch) => [acc + batch.numRows, batch]),
 *   Stream.takeWhile((_, totalRows) => totalRows < 1000),
 *   Stream.runDrain,
 * )
 */
export const fetch = (
  client: ArrowFlightClient,
  options: FetchOptions,
): Stream.Stream<RecordBatch, WingsError> => {
  const schema = options.topic.schema;
  let currentOffset = options.offset ?? 0n;

  return Stream.repeatEffect(
    Effect.gen(function* () {
      const ticket = createAny(FetchTicket, {
        topicName: options.topic.name,
        // @ts-expect-error - protobuf type incompatibility between different proto files
        partitionValue: options.partitionValue,
        offset: currentOffset,
        minBatchSize: options.minBatchSize ?? 1,
        maxBatchSize: options.maxBatchSize ?? 100,
      });

      const batches: RecordBatch[] = yield* Effect.tryPromise({
        try: async () => {
          const response = client.doGet(createTicket(ticket), { schema });
          const result: RecordBatch[] = [];

          for await (const batch of response) {
            result.push(batch);
          }

          return result;
        },
        catch: (error) =>
          new WingsError({
            message: "Failed to fetch data",
            cause: error,
          }),
      });

      // Update offset
      if (batches.length > 0) {
        const lastBatch = batches[batches.length - 1];
        const offsetColumn = lastBatch.getChild("__offset__");
        if (offsetColumn && offsetColumn.length > 0) {
          const lastOffset = offsetColumn.get(offsetColumn.length - 1);
          currentOffset = lastOffset + 1n;
        }
      }

      return batches;
    }),
  ).pipe(Stream.flatMap((batches) => Stream.fromIterable(batches)));
};
